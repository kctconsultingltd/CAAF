import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deal-submission.deal-submission', ({ strapi }) => ({
  async create(ctx) {
    // Accept both Strapi REST format { data: {...} } and raw form data { businessName: ... }
    const raw = (ctx.request.body?.data && typeof ctx.request.body.data === 'object')
      ? ctx.request.body.data
      : (ctx.request.body ?? {});

    // Validate required fields before hitting the DB
    const missing = (['businessName', 'industry', 'contactEmail'] as const).filter(
      (f) => !raw[f]
    );
    if (missing.length > 0) {
      return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(raw.contactEmail)) {
      return ctx.badRequest('Invalid email address.');
    }

    // Force status=pending regardless of what the client sends
    ctx.request.body = {
      data: {
        businessName: raw.businessName,
        industry: raw.industry,
        revenue: raw.revenue ?? null,
        fundingNeeded: raw.fundingNeeded ?? null,
        description: raw.description ?? null,
        contactEmail: raw.contactEmail,
        phone: raw.phone ?? null,
        reviewStatus: 'pending',
      },
    };

    // Persist via core create
    await super.create(ctx);
    const saved = ctx.body as { data?: { documentId?: string } };

    // Notify admin and submitter — fire-and-forget; email failure must not fail the HTTP response
    const svc = strapi.service('api::deal-submission.deal-submission') as {
      notifyAdmin: (p: object) => Promise<void>;
      notifySubmitter: (email: string, businessName: string) => Promise<void>;
    };
    svc.notifyAdmin({
        businessName: raw.businessName,
        industry: raw.industry,
        revenue: raw.revenue,
        fundingNeeded: raw.fundingNeeded,
        description: raw.description,
        contactEmail: raw.contactEmail,
        phone: raw.phone ?? null,
      })
      .catch((err: Error) =>
        strapi.log.error('[deal-submission] Admin notification failed:', err.message)
      );
    svc.notifySubmitter(raw.contactEmail, raw.businessName)
      .catch((err: Error) =>
        strapi.log.error('[deal-submission] Submitter confirmation failed:', err.message)
      );

    // Return a minimal response — don't expose all internal fields to the public
    ctx.body = {
      data: { documentId: saved?.data?.documentId ?? null },
      message: 'Your submission has been received. We will review it and be in touch soon.',
    };
  },
}));
