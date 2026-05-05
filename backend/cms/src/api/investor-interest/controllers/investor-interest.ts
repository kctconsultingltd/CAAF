import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::investor-interest.investor-interest', ({ strapi }) => ({
  async create(ctx) {
    const raw = (ctx.request.body?.data && typeof ctx.request.body.data === 'object')
      ? ctx.request.body.data
      : (ctx.request.body ?? {});

    // Validate required fields
    const missing = (['investorName', 'email', 'dealId'] as const).filter((f) => !raw[f]);
    if (missing.length > 0) {
      return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(raw.email as string)) {
      return ctx.badRequest('Invalid email address.');
    }

    // Verify the deal exists and is approved
    const deal = await strapi
      .documents('api::deal.deal')
      .findOne({ documentId: raw.dealId as string });

    if (!deal) {
      return ctx.notFound('Deal not found.');
    }
    if ((deal as any).reviewStatus !== 'approved') {
      return ctx.badRequest('Deal is not open for investor interest.');
    }

    // Build body in Strapi REST format with relation
    ctx.request.body = {
      data: {
        investorName: raw.investorName,
        email: raw.email,
        phone: raw.phone ?? null,
        investmentRange: raw.investmentRange ?? null,
        notes: raw.notes ?? null,
        linkedDeal: raw.dealId,
      },
    };

    await super.create(ctx);
    const saved = ctx.body as { data?: { documentId?: string } };

    // Notify admin and investor — fire-and-forget
    const svc = strapi.service('api::investor-interest.investor-interest') as {
      notifyAdmin: (p: object) => Promise<void>;
      notifyInvestor: (email: string, investorName: string, dealName: string) => Promise<void>;
    };
    const dealName = (deal as any).businessName ?? raw.dealId;

    svc.notifyAdmin({
        investorName: raw.investorName,
        email: raw.email,
        phone: raw.phone ?? null,
        dealName,
        investmentRange: raw.investmentRange ?? null,
        notes: raw.notes ?? null,
      })
      .catch((err: Error) =>
        strapi.log.error('[investor-interest] Admin notification failed:', err.message)
      );
    svc.notifyInvestor(raw.email, raw.investorName, dealName)
      .catch((err: Error) =>
        strapi.log.error('[investor-interest] Investor confirmation failed:', err.message)
      );

    ctx.body = {
      data: { documentId: saved?.data?.documentId ?? null },
      message: 'Thank you for your interest. We will be in touch shortly.',
    };
  },
}));
