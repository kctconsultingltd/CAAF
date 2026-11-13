import { Resend } from 'resend';
import { buildBookEmail, BookEmailInput } from './book-email-template';

// Files up to this size travel as an attachment; bigger ones as a link, so the
// email stays deliverable (most inboxes reject messages over ~10-25 MB).
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export interface BookFile {
  url: string;
  name?: string;
  size?: number; // Strapi stores file sizes in KB
}

export interface SendResult {
  mode: 'attachment' | 'link';
  mocked: boolean;
}

function fileName(book: { title: string }, file: BookFile): string {
  if (file.name && /\.pdf$/i.test(file.name)) return file.name;
  const base = book.title.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-') || 'book';
  return base + '.pdf';
}

/**
 * Emails a book to the reader. Throws when the email provider rejects the
 * message, so the caller can tell the visitor it wasn't sent.
 */
export interface BookInfo {
  title: string;
  author?: string | null;
  description?: string | null;
  cover?: any;
}

/** Best email-sized rendition of the cover (Strapi media), or null. */
function coverImage(cover: any): BookEmailInput['cover'] {
  if (!cover?.url) return null;
  const f = cover.formats?.medium || cover.formats?.small || cover;
  return { url: f.url, width: f.width ?? cover.width, height: f.height ?? cover.height };
}

export async function sendBookEmail(
  strapi: any,
  to: string,
  book: BookInfo,
  file: BookFile,
  viaSubscription: boolean
): Promise<SendResult> {
  const sizeBytes = (Number(file.size) || 0) * 1024;
  const mode: SendResult['mode'] = sizeBytes > 0 && sizeBytes <= MAX_ATTACHMENT_BYTES ? 'attachment' : 'link';
  const filename = fileName(book, file);
  const from = process.env.EMAIL_FROM || 'noreply@capitalasaforce.com';
  const { subject, html, text } = buildBookEmail({
    title: book.title,
    author: book.author,
    description: book.description,
    cover: coverImage(book.cover),
    mode,
    fileUrl: file.url,
    filename,
    sizeBytes,
    viaSubscription,
  });

  // Same providers the rest of the site uses: ZeptoMail first (pitch
  // submissions), Resend otherwise (deal and investor forms).
  const zepto = process.env.ZEPTO_MAIL_API_TOKEN;
  if (zepto) {
    await sendViaZeptoMail({ token: zepto, from, to, subject, html, text, mode, file, filename });
    return { mode, mocked: false };
  }

  const key = process.env.RESEND_API_KEY;
  if (key) {
    const { error } = await new Resend(key).emails.send({
      from: from.includes('<') ? from : `Capital As A Force <${from}>`,
      to,
      subject,
      text,
      html,
      ...(mode === 'attachment' ? { attachments: [{ filename, path: file.url }] } : {}),
    });
    if (error) throw new Error(`Resend ${error.name}: ${error.message}`);
    return { mode, mocked: false };
  }

  strapi.log.info(
    `[resource-mail] Email mock (set ZEPTO_MAIL_API_TOKEN or RESEND_API_KEY to enable): To: ${to} | ` +
      `Subject: ${subject} | ` +
      (mode === 'attachment' ? `attachment ${filename} from ${file.url}` : `link ${file.url}`)
  );
  return { mode, mocked: true };
}

async function sendViaZeptoMail(p: {
  token: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  mode: SendResult['mode'];
  file: BookFile;
  filename: string;
}): Promise<void> {
  let attachments: { content: string; mime_type: string; name: string }[] | undefined;
  if (p.mode === 'attachment') {
    const res = await fetch(p.file.url);
    if (!res.ok) throw new Error(`Could not fetch the PDF (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    attachments = [{ content: buf.toString('base64'), mime_type: 'application/pdf', name: p.filename }];
  }
  const auth = p.token.startsWith('Zoho-enczapikey ') ? p.token : `Zoho-enczapikey ${p.token}`;
  const res = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      from: { address: p.from, name: 'Capital As A Force' },
      to: [{ email_address: { address: p.to } }],
      subject: p.subject,
      htmlbody: p.html,
      textbody: p.text,
      ...(attachments ? { attachments } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ZeptoMail ${res.status}: ${body.slice(0, 300)}`);
  }
}
