import { factories } from '@strapi/strapi';

interface SubmissionPayload {
  businessName: string;
  industry: string;
  revenue?: number | null;
  fundingNeeded?: number | null;
  description?: string | null;
  contactEmail: string;
}

const service = factories.createCoreService('api::deal-submission.deal-submission', ({ strapi }) => ({
  async notifyAdmin(submission: SubmissionPayload): Promise<void> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    const subject = `New Deal Submission: ${submission.businessName}`;
    const lines = [
      'A new deal submission has been received.',
      '',
      `Business:       ${submission.businessName}`,
      `Industry:       ${submission.industry}`,
      `Contact:        ${submission.contactEmail}`,
      submission.revenue != null
        ? `Revenue:        $${submission.revenue.toLocaleString()}`
        : null,
      submission.fundingNeeded != null
        ? `Funding needed: $${submission.fundingNeeded.toLocaleString()}`
        : null,
      submission.description
        ? `\nDescription:\n${submission.description}`
        : null,
      '',
      'Log in to the admin panel to review, approve, or reject this submission.',
    ].filter((l): l is string => l !== null);

    const text = lines.join('\n');

    const emailPlugin = strapi.plugin('email');

    if (emailPlugin && adminEmail) {
      await emailPlugin.service('email').send({ to: adminEmail, subject, text });
      strapi.log.info(`[deal-submission] Admin notification sent to ${adminEmail}`);
      return;
    }

    // Development mock — prints what would have been sent
    strapi.log.info(
      '[deal-submission] Email mock' +
        (adminEmail ? '' : ' (set ADMIN_NOTIFICATION_EMAIL to enable)') +
        ':\n' +
        `To: ${adminEmail ?? '(not configured)'}\n` +
        `Subject: ${subject}\n\n` +
        text
    );
  },
}));

export default service;
