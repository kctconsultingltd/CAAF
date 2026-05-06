import { factories } from '@strapi/strapi';
import { Resend } from 'resend';

interface InterestPayload {
  investorName: string;
  email: string;
  phone?: string | null;
  dealName: string;
  investmentRange?: string | null;
  notes?: string | null;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const service = factories.createCoreService('api::investor-interest.investor-interest', ({ strapi }) => ({
  async notifyAdmin(payload: InterestPayload): Promise<void> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const from = process.env.EMAIL_FROM || 'noreply@example.com';

    const subject = `New Investor Interest: ${payload.investorName} → ${payload.dealName}`;
    const lines = [
      'A new investor has expressed interest in a deal.',
      '',
      `Investor:         ${payload.investorName}`,
      `Email:            ${payload.email}`,
      payload.phone ? `Phone:            ${payload.phone}` : null,
      `Deal:             ${payload.dealName}`,
      payload.investmentRange ? `Investment Range: ${payload.investmentRange}` : null,
      payload.notes ? `\nNotes:\n${payload.notes}` : null,
      '',
      'Log in to the admin panel to review this interest.',
    ].filter((l): l is string => l !== null);

    const text = lines.join('\n');
    const resend = getResend();

    if (resend && adminEmail) {
      await resend.emails.send({ from, to: adminEmail, subject, text });
      strapi.log.info(`[investor-interest] Admin notification sent to ${adminEmail}`);
      return;
    }

    strapi.log.info(
      '[investor-interest] Email mock' +
        (adminEmail ? '' : ' (set ADMIN_NOTIFICATION_EMAIL to enable)') +
        (resend ? '' : ' (set RESEND_API_KEY to enable)') +
        `:\nTo: ${adminEmail ?? '(not configured)'}\nSubject: ${subject}\n\n${text}`
    );
  },

  async notifyInvestor(email: string, investorName: string, dealName: string): Promise<void> {
    const from = process.env.EMAIL_FROM || 'noreply@example.com';
    const subject = `Thank you for your interest — CAAF`;
    const text = [
      `Hi ${investorName},`,
      '',
      `Thank you for expressing interest in ${dealName} through CAAF.`,
      'Our team will review your submission and reach out to discuss next steps.',
      '',
      'The CAAF Team',
    ].join('\n');

    const resend = getResend();

    if (resend) {
      await resend.emails.send({ from, to: email, subject, text });
      strapi.log.info(`[investor-interest] Investor confirmation sent to ${email}`);
      return;
    }

    strapi.log.info(
      `[investor-interest] Investor confirmation mock (set RESEND_API_KEY to enable):\nTo: ${email}\nSubject: ${subject}\n\n${text}`
    );
  },
}));

export default service;
