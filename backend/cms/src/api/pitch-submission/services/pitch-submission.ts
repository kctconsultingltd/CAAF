import { factories } from '@strapi/strapi';

interface PitchPayload {
  fullName: string;
  email: string;
  phone?: string | null;
  businessName: string;
  dealDescription: string;
  currentTurnover?: string | null;
  fundingRequest: string;
  deckUrl?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function field(label: string, value: string, isHtml = false): string {
  const gold  = '#c89e2a';
  const white = '#e8f0f8';
  return `
  <tr>
    <td style="padding:0 0 20px;">
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${gold};margin-bottom:5px;font-family:Arial,sans-serif;">${label}</div>
      <div style="font-size:14px;color:${white};line-height:1.65;font-family:Arial,sans-serif;">${isHtml ? value : esc(value)}</div>
      <div style="margin-top:12px;height:1px;background:rgba(200,150,42,.15);"></div>
    </td>
  </tr>`;
}

function buildHtmlEmail(s: PitchPayload): string {
  const gold  = '#c89e2a';
  const bg    = '#06111f';
  const bg2   = '#081629';
  const muted = '#7a8fa6';
  const white = '#e8f0f8';

  const emailLink = `<a href="mailto:${esc(s.email)}" style="color:${gold};text-decoration:none;">${esc(s.email)}</a>`;
  const deckLink  = s.deckUrl
    ? `<a href="${esc(s.deckUrl)}" style="color:${gold};text-decoration:none;">View uploaded deck &rarr;</a>`
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>New Pitch Submission</title></head>
<body style="margin:0;padding:28px 0;background:${bg};font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:0 16px;">

<table width="600" cellpadding="0" cellspacing="0" border="0"
  style="max-width:600px;width:100%;background:${bg2};border:1px solid rgba(200,150,42,.25);border-radius:8px;overflow:hidden;">

  <!-- HEADER -->
  <tr>
    <td style="background:${bg};padding:28px 40px;border-bottom:2px solid rgba(200,150,42,.4);">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${muted};font-family:Arial,sans-serif;">Capital As A Force</div>
      <div style="font-size:24px;font-weight:700;color:${gold};margin-top:8px;letter-spacing:.02em;font-family:Georgia,'Times New Roman',serif;">New Pitch Submission</div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:32px 40px 4px;">
      <p style="color:${muted};font-size:14px;margin:0 0 28px;font-family:Arial,sans-serif;">
        A new business pitch was submitted via the website.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${field('Full Name', s.fullName)}
        ${field('Email', emailLink, true)}
        ${s.phone ? field('Phone', s.phone) : ''}
        ${field('Business Name', s.businessName)}
        ${field('Funding Request', '$' + s.fundingRequest)}
        ${s.currentTurnover ? field('Current Turnover', '$' + s.currentTurnover) : ''}
        <tr>
          <td style="padding:0 0 20px;">
            <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${gold};margin-bottom:5px;font-family:Arial,sans-serif;">Deal Description</div>
            <div style="font-size:14px;color:${white};line-height:1.75;font-family:Arial,sans-serif;white-space:pre-wrap;">${esc(s.dealDescription)}</div>
            <div style="margin-top:12px;height:1px;background:rgba(200,150,42,.15);"></div>
          </td>
        </tr>
        ${deckLink ? field('Pitch Deck', deckLink, true) : ''}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:12px 40px 40px;">
      <a href="https://admin.capitalasaforce.com"
         style="display:inline-block;background:${gold};color:${bg};font-size:11px;font-weight:700;
                letter-spacing:.12em;text-transform:uppercase;text-decoration:none;
                padding:13px 32px;border-radius:2px;font-family:Arial,sans-serif;">
        View in Admin Panel &rarr;
      </a>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 40px;border-top:1px solid rgba(200,150,42,.2);">
      <p style="margin:0;font-size:12px;color:${muted};font-family:Arial,sans-serif;">
        Capital As A Force &mdash;
        <a href="https://capitalasaforce.com" style="color:${gold};text-decoration:none;">capitalasaforce.com</a>
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}

async function sendViaZeptoMail(payload: {
  to: string;
  from: string;
  subject: string;
  htmlbody: string;
  token: string;
}): Promise<void> {
  // ZeptoMail requires "Zoho-enczapikey <key>" — prefix it if the user only stored the key itself
  const authHeader = payload.token.startsWith('Zoho-enczapikey ')
    ? payload.token
    : `Zoho-enczapikey ${payload.token}`;

  const body = JSON.stringify({
    from: { address: payload.from },
    to: [{ email_address: { address: payload.to } }],
    subject: payload.subject,
    htmlbody: payload.htmlbody,
  });

  const res = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const resBody = await res.text().catch(() => '(unreadable)');
    throw new Error(`ZeptoMail ${res.status}: ${resBody}`);
  }
}

export default factories.createCoreService(
  'api::pitch-submission.pitch-submission' as any,
  ({ strapi }) => ({
    async notifyAdmin(submission: PitchPayload): Promise<void> {
      const token      = process.env.ZEPTO_MAIL_API_TOKEN;
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      const from       = process.env.EMAIL_FROM ?? 'noreply@capitalasaforce.com';

      strapi.log.info(
        `[pitch-submission] notifyAdmin — token:${token ? 'SET' : 'MISSING'} | to:${adminEmail ?? 'MISSING'} | from:${from}`
      );

      if (!token || !adminEmail) {
        strapi.log.warn(
          '[pitch-submission] Email not sent — missing env vars:' +
            (!token ? ' ZEPTO_MAIL_API_TOKEN' : '') +
            (!adminEmail ? ' ADMIN_NOTIFICATION_EMAIL' : '')
        );
        return;
      }

      const subject  = `New Pitch Submission: ${submission.businessName}`;
      const htmlbody = buildHtmlEmail(submission);

      await sendViaZeptoMail({ to: adminEmail, from, subject, htmlbody, token });
      strapi.log.info(`[pitch-submission] Email sent to ${adminEmail}`);
    },
  })
);
