import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deal.deal', ({ strapi }) => ({
  async find(ctx) {
    // Unauthenticated requests can only see approved deals regardless of query params
    if (!ctx.state.user) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(typeof ctx.query.filters === 'object' && ctx.query.filters !== null
            ? (ctx.query.filters as object)
            : {}),
          reviewStatus: 'approved',
        },
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
