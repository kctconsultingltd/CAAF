import { factories } from '@strapi/strapi';
import { normalizeEmail, subscriberPlan } from '../../../utils/substack';

export default factories.createCoreController(
  'api::substack-subscriber.substack-subscriber',
  ({ strapi }) => ({
    // { subscribed: true } only for active paid subscribers (they get every
    // book free). plan tells the site whether to suggest subscribing or upgrading.
    async check(ctx) {
      const email = normalizeEmail((ctx.request.body as any)?.email);
      if (!email) return ctx.badRequest('Please enter a valid email address.');
      const plan = await subscriberPlan(strapi, email);
      ctx.body = { subscribed: plan === 'paid', plan };
    },
  })
);
