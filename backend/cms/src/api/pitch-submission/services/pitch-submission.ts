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

async function sendViaZeptoMail(payload: {
  to: string;
  from: string;
  subject: string;
  textbody: string;
  token: string;
}): Promise<void> {
  const res = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: {
      Authorization: payload.token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: { address: payload.from },
      to: [{ email_address: { address: payload.to } }],
      subject: payload.subject,
      textbody: payload.textbody,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new Error(`Zepto Mail error ${res.status}: ${body}`);
  }
}

export default factories.createCoreService(
  'api::pitch-submission.pitch-submission' as any,
  ({ strapi }) => ({
    async notifyAdmin(submission: PitchPayload): Promise<void> {
      const token     = process.env.ZEPTO_MAIL_API_TOKEN;
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      const from      = process.env.EMAIL_FROM ?? 'noreply@capitalasaforce.com';

      const subject = `New Pitch Submission: ${submission.businessName}`;
      const lines = [
        'A new business pitch has been submitted via the website.',
        '',
        `Full Name:        ${submission.fullName}`,
        `Email:            ${submission.email}`,
        submission.phone ? `Phone:            ${submission.phone}` : null,
        `Business Name:    ${submission.businessName}`,
        `Funding Request:  ${submission.fundingRequest}`,
        submission.currentTurnover ? `Current Turnover: ${submission.currentTurnover}` : null,
        '',
        'Deal Description:',
        submission.dealDescription,
        submission.deckUrl ? `\nPitch Deck: ${submission.deckUrl}` : null,
        '',
        'Log into the Strapi admin to view the full submission.',
      ].filter((l): l is string => l !== null);

      const textbody = lines.join('\n');

      if (token && adminEmail) {
        await sendViaZeptoMail({ to: adminEmail, from, subject, textbody, token });
        strapi.log.info(`[pitch-submission] Admin notification sent to ${adminEmail}`);
        return;
      }

      strapi.log.info(
        '[pitch-submission] Email mock' +
          (adminEmail ? '' : ' (set ADMIN_NOTIFICATION_EMAIL to enable)') +
          (token ? '' : ' (set ZEPTO_MAIL_API_TOKEN to enable)') +
          `:\nSubject: ${subject}\n\n${textbody}`
      );
    },
  })
);
