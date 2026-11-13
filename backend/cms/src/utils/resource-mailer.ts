import { Resend } from 'resend';

// Files up to this size travel as an attachment; bigger ones as a link, so the
// email stays deliverable (most inboxes reject messages over ~10-25 MB).
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
export async function sendBookEmail(
  strapi: any,
  to: string,
  book: { title: string; author?: string | null },
  file: BookFile,
  viaSubscription: boolean
): Promise<SendResult> {
  const sizeBytes = (Number(file.size) || 0) * 1024;
  const mode: SendResult['mode'] = sizeBytes > 0 && sizeBytes <= MAX_ATTACHMENT_BYTES ? 'attachment' : 'link';
  const filename = fileName(book, file);
  const from = process.env.EMAIL_FROM || 'noreply@capitalasaforce.com';
  const subject = `Your copy of ${book.title}`;
  const byline = book.author ? ` by ${book.author}` : '';
  const thanks = viaSubscription
    ? 'As a subscriber to Capital As A Force on Substack, this one is on us.'
    : 'Thank you for your interest in our research.';

  const text = [
    'Hi,',
    '',
    mode === 'attachment'
      ? `Your copy of "${book.title}"${byline} is attached to this email.`
      : `Here is your copy of "${book.title}"${byline}:\n${file.url}`,
    '',
    thanks,
    '',
    'Capital As A Force',
    'https://www.capitalasaforce.com',
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1b2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-top:3px solid #c8962a">
<tr><td style="padding:32px 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6a1f">Capital As A Force &middot; Resources</td></tr>
<tr><td style="padding:0 32px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#06111f">${esc(book.title)}</td></tr>
${book.author ? `<tr><td style="padding:6px 32px 0;font-size:14px;color:#5b6573">${esc(book.author)}</td></tr>` : ''}
<tr><td style="padding:20px 32px 0;font-size:15px;line-height:1.6">
${mode === 'attachment'
    ? 'Your copy is attached to this email as a PDF.'
    : `Your copy is ready to download:</td></tr>
<tr><td style="padding:16px 32px 0"><a href="${esc(file.url)}" style="display:inline-block;background:#06111f;color:#ffffff;text-decoration:none;padding:12px 24px;font-size:14px;letter-spacing:1px">Download the PDF</a>`}
</td></tr>
<tr><td style="padding:20px 32px 32px;font-size:14px;line-height:1.6;color:#5b6573">${esc(thanks)}</td></tr>
</table>
<p style="font-size:12px;color:#8b93a0;margin:16px 0 0">You received this because this address was entered to request the book on capitalasaforce.com.</p>
</td></tr></table></body></html>`;

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
      from,
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
