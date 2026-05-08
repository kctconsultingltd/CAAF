import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deal.deal', ({ strapi }) => ({
  async find(ctx) {
    // Unauthenticated requests can only see approved deals.
    // Strip Strapi operator keys ($or, $and, $not, etc.) from user-supplied filters
    // so attackers cannot bypass the reviewStatus gate via $or / $not conditions.
    if (!ctx.state.user) {
      const userFilters =
        typeof ctx.query.filters === 'object' && ctx.query.filters !== null
          ? (ctx.query.filters as Record<string, unknown>)
          : {};
      const safeFilters: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(userFilters)) {
        if (!key.startsWith('$')) safeFilters[key] = val;
      }
      ctx.query = {
        ...ctx.query,
        filters: { ...safeFilters, reviewStatus: 'approved' },
      };
    }
    return super.find(ctx);
  },

  async findOne(ctx) {
    // For unauthenticated requests, reject non-approved deals with 404 (not 403)
    // so internal IDs/statuses are not leaked
    if (!ctx.state.user) {
      const { documentId } = ctx.params;
      const deal = await strapi.documents('api::deal.deal').findOne({ documentId });
      if (!deal || deal.status !== 'approved') {
        return ctx.notFound();
      }
    }
    return super.findOne(ctx);
  },
}));
