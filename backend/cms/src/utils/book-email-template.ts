// The email a reader receives with a book from Research > Resources.
//
// Built for email clients, not browsers: table layout, inline styles, web-safe
// fonts (Georgia for titles, Arial for text), a light reading body so it
// survives Gmail/Outlook dark-mode inversion, and a navy band carrying the
// brand. One <style> block adds the small-screen tweaks clients that support
// media queries will use.

const SITE = 'https://www.capitalasaforce.com';
// Trimmed logo served with Cross-Origin-Resource-Policy: cross-origin (see
// vercel.json) so webmail clients may load it. 212×187, shown at 73×64.
const LOGO = `${SITE}/img/email/caaf-logo.png`;
const SUBSTACK = 'https://tochukwuezeukwu.substack.com';
const CONTACT = 'info@capitalasaforce.com';

const C = {
  navy: '#06111f',
  navy2: '#0b1d33',
  gold: '#b8860b', // a shade darker than the site's #c8962a so it reads on white
  goldBright: '#c8962a',
  paper: '#ffffff',
  page: '#eef0f3',
  ink: '#14202e',
  body: '#3d4a59',
  muted: '#6b7685',
  rule: '#e3e6ea',
  callout: '#f7f3e8',
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface BookEmailInput {
  title: string;
  author?: string | null;
  description?: string | null;
  cover?: { url: string; width?: number | null; height?: number | null } | null;
  mode: 'attachment' | 'link';
  fileUrl: string;
  filename: string;
  sizeBytes: number;
  viaSubscription: boolean;
}

function sizeLabel(bytes: number): string {
  if (!bytes) return 'PDF';
  return bytes >= 1024 * 1024 ? `PDF · ${(bytes / 1024 / 1024).toFixed(1)} MB` : `PDF · ${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function excerpt(text: string | null | undefined, max = 220): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(' ', max)).replace(/[,.;:]$/, '') + '…';
}

export function buildBookEmail(b: BookEmailInput): { subject: string; html: string; text: string; preheader: string } {
  const subject = `Your copy of ${b.title}`;
  const preheader =
    b.mode === 'attachment'
      ? `${b.title} is attached as a PDF.`
      : `${b.title} is ready to download.`;
  const intro = b.viaSubscription
    ? 'Thank you for being a paid subscriber to Capital As A Force. Every book in our library is included with your subscription.'
    : 'Thank you for your interest in our research.';
  const about = excerpt(b.description);

  // Landscape covers (auto-generated from a slide deck's first page) span the
  // card; portrait book covers sit at book size.
  const landscape = !!(b.cover?.width && b.cover?.height && b.cover.width > b.cover.height);
  const coverWidth = landscape ? 520 : 180;
  const coverHtml = b.cover?.url
    ? `<tr><td class="px" align="${landscape ? 'center' : 'left'}" style="padding:0 40px 28px;">
        <img src="${esc(b.cover.url)}" width="${coverWidth}" alt="Cover of ${esc(b.title)}"
          style="display:block;width:${coverWidth}px;max-width:100%;height:auto;border:1px solid ${C.rule};" />
      </td></tr>`
    : '';

  const delivery =
    b.mode === 'attachment'
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.callout};border-left:3px solid ${C.goldBright};">
          <tr>
            <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.gold};font-weight:bold;">Attached to this email</div>
              <div style="margin-top:6px;font-size:15px;line-height:22px;color:${C.ink};word-break:break-word;">${esc(b.filename)}</div>
              <div style="margin-top:2px;font-size:13px;line-height:20px;color:${C.muted};">${sizeLabel(b.sizeBytes)}</div>
            </td>
          </tr>
        </table>`
      : `<table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:${C.navy};">
              <a href="${esc(b.fileUrl)}" class="btn"
                style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                Download the PDF &rarr;
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${C.muted};">
          ${sizeLabel(b.sizeBytes)}. The file is too large to attach, so it's waiting for you at the link above.
        </p>`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(subject)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .card { width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 26px !important; line-height: 32px !important; }
    .btn { display: block !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 12px;">

  <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.paper};">

    <!-- Brand band -->
    <tr>
      <td class="px" style="background:${C.navy};padding:22px 40px;border-bottom:3px solid ${C.goldBright};">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${LOGO}" width="73" height="64" alt="Capital As A Force"
            style="display:block;width:73px;height:64px;border:0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:22px;" />
        </a>
      </td>
    </tr>

    <!-- Heading -->
    <tr>
      <td class="px" style="padding:36px 40px 0;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold};font-weight:bold;">
          ${b.viaSubscription ? 'Included with your subscription' : 'Your book'}
        </div>
        <h1 class="h1" style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;font-weight:normal;color:${C.ink};">
          ${esc(b.title)}
        </h1>
        ${b.author ? `<div style="margin-top:8px;font-size:15px;line-height:22px;color:${C.muted};">${esc(b.author)}</div>` : ''}
      </td>
    </tr>
    <tr><td style="height:28px;line-height:28px;font-size:0;">&nbsp;</td></tr>

    ${coverHtml}

    <!-- Message -->
    <tr>
      <td class="px" style="padding:0 40px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${C.body};">
        <p style="margin:0 0 16px;">Hello,</p>
        <p style="margin:0 0 ${about ? '16px' : '24px'};">${intro} Here is your copy of <strong style="color:${C.ink};">${esc(b.title)}</strong>.</p>
        ${about ? `<p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:26px;color:${C.body};">${esc(about)}</p>` : ''}
      </td>
    </tr>

    <!-- Delivery -->
    <tr>
      <td class="px" style="padding:0 40px 36px;">
        ${delivery}
      </td>
    </tr>

    <!-- More from CAAF -->
    <tr>
      <td class="px" style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.rule};">
          <tr>
            <td style="padding:24px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${C.body};">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold};font-weight:bold;margin-bottom:8px;">Keep reading</div>
              Explore more of our <a href="${SITE}/blog#insights" style="color:${C.ink};font-weight:bold;">research and insights</a>,
              browse the full <a href="${SITE}/blog#resources" style="color:${C.ink};font-weight:bold;">resources library</a>${
                b.viaSubscription
                  ? ''
                  : `, or <a href="${SUBSTACK}/subscribe" style="color:${C.ink};font-weight:bold;">subscribe on Substack</a>. Paid subscribers get every book free`
              }.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td class="px" style="background:${C.navy};padding:26px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#a9b4c2;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#ffffff;margin-bottom:6px;">Capital As A Force</div>
        An Africa-focused access-to-finance organization helping to unlock capital for transformative impact.
        <div style="margin-top:14px;">
          <a href="${SITE}" style="color:${C.goldBright};text-decoration:none;">capitalasaforce.com</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${CONTACT}" style="color:${C.goldBright};text-decoration:none;">${CONTACT}</a>
        </div>
        <div style="margin-top:14px;color:#7d8a9b;">
          You received this email because this address was entered to request a book on capitalasaforce.com.
        </div>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  const text = [
    b.viaSubscription ? 'INCLUDED WITH YOUR SUBSCRIPTION' : 'YOUR BOOK',
    b.title + (b.author ? ` by ${b.author}` : ''),
    '',
    'Hello,',
    '',
    `${intro} Here is your copy of "${b.title}".`,
    '',
    b.mode === 'attachment'
      ? `It's attached to this email: ${b.filename} (${sizeLabel(b.sizeBytes)}).`
      : `Download it here (${sizeLabel(b.sizeBytes)}):\n${b.fileUrl}`,
    '',
    'Keep reading',
    `Research and insights: ${SITE}/blog#insights`,
    `Resources library: ${SITE}/blog#resources`,
    ...(b.viaSubscription ? [] : [`Subscribe on Substack (paid subscribers get every book free): ${SUBSTACK}/subscribe`]),
    '',
    '--',
    'Capital As A Force',
    `${SITE} · ${CONTACT}`,
    'You received this email because this address was entered to request a book on capitalasaforce.com.',
  ].join('\n');

  return { subject, html, text, preheader };
}
