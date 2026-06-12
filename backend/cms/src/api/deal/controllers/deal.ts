import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deal.deal', ({ strapi }) => ({
  async find(ctx) {
    if (!ctx.state.user) {
      // Only whitelist the `industry` filter — never spread arbitrary user-supplied
      // filter objects, which could inject $or/$and operators.
      const incoming = typeof ctx.query.filters === 'object' && ctx.query.filters !== null
        ? (ctx.query.filters as Record<string, unknown>)
        : {};
      ctx.query = {
        ...ctx.query,
        filters: {
          reviewStatus: 'approved',
          ...(incoming.industry != null ? { industry: incoming.industry } : {}),
        },
      };
    }
    return super.find(ctx);
  },

  async findOne(ctx) {
    if (!ctx.state.user) {
      const { documentId } = ctx.params;
      const deal = await strapi.documents('api::deal.deal').findOne({ documentId });
      // Return 404 for both missing and non-approved deals — don't reveal status to callers
      if (!deal || (deal as any).reviewStatus !== 'approved') {
        return ctx.notFound();
      }
    }
    return super.findOne(ctx);
  },
}));
