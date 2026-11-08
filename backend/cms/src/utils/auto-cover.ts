import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const UID = 'api::resource.resource';

// pdf.js uses Promise.withResolvers, which Node only ships from v22.
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function () {
    let resolve: (v: unknown) => void, reject: (e: unknown) => void;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

async function renderPage(pdf: Buffer, page: number): Promise<{ png: Buffer; page: number } | null> {
  // Loaded lazily so a broken native canvas build can't stop Strapi from booting.
  const { pdfToPng } = require('pdf-to-png-converter');
  const render = async (p: number) => {
    const [out] = await pdfToPng(pdf, { pagesToProcess: [p], viewportScale: 2, verbosityLevel: 0 });
    return out ? { png: out.content as Buffer, page: p } : null;
  };
  // Pages beyond the end of the PDF are skipped by the renderer; fall back to page 1.
  return (await render(page)) ?? (page !== 1 ? await render(1) : null);
}

async function uploadPng(strapi: any, png: Buffer, name: string): Promise<any> {
  const tmpPath = path.join(os.tmpdir(), name + '-' + Date.now() + '.png');
  fs.writeFileSync(tmpPath, png);
  try {
    const [uploaded] = await strapi.plugin('upload').service('upload').upload({
      data: {},
      files: { filepath: tmpPath, originalFilename: name + '.png', mimetype: 'image/png', size: png.length },
    });
    return uploaded;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

/**
 * Keeps a book's cover in sync with a page of its PDF, unless an admin
 * uploaded their own cover (a cover whose id isn't the one we generated).
 * Never throws: saving a book must not fail because of cover generation.
 */
export async function ensureAutoCover(strapi: any, documentId: string): Promise<void> {
  try {
    const book: any = await strapi.db.query(UID).findOne({
      where: { documentId },
      populate: ['file', 'cover'],
    });
    if (!book?.file || book.file.mime !== 'application/pdf') return;
    if (book.cover && book.cover.id !== book.autoCoverId) return; // manual cover wins

    const page = Math.max(1, Math.floor(Number(book.coverPage) || 1));
    const wanted = `${book.file.id}:${page}`;
    if (book.cover && book.autoCoverKey === wanted) return; // already up to date

    const res = await fetch(book.file.url);
    if (!res.ok) throw new Error('PDF download failed: ' + res.status);
    const rendered = await renderPage(Buffer.from(await res.arrayBuffer()), page);
    if (!rendered) throw new Error('could not render any page of the PDF');
    if (rendered.page !== page) {
      strapi.log.warn(`[auto-cover] "${book.title}": page ${page} is past the end of the PDF; used page 1`);
    }

    const slug = String(book.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'book';
    const uploaded = await uploadPng(strapi, rendered.png, slug + '-cover');

    await strapi.db.query(UID).update({
      where: { id: book.id },
      data: { cover: uploaded.id, autoCoverId: uploaded.id, autoCoverKey: wanted },
    });
    strapi.log.info(`[auto-cover] "${book.title}": cover generated from page ${rendered.page}`);

    // Remove the previously generated image so stale covers don't pile up.
    if (book.autoCoverId && book.autoCoverId !== uploaded.id) {
      const old = await strapi.db.query('plugin::upload.file').findOne({ where: { id: book.autoCoverId } });
      if (old) await strapi.plugin('upload').service('upload').remove(old);
    }
  } catch (err: any) {
    strapi.log.warn(`[auto-cover] ${documentId}: ${err?.message || err}`);
  }
}
