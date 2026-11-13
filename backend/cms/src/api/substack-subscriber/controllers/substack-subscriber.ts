import { factories } from '@strapi/strapi';
import {
  isActiveSubscriber,
  normalizeEmail,
  subscribeOnSubstack,
  substackSubscribeUrl,
  upsertSubscribers,
} from '../../../utils/substack';

export default factories.createCoreController(
  'api::substack-subscriber.substack-subscriber',
  ({ strapi }) => ({
    async check(ctx) {
      const email = normalizeEmail((ctx.request.body as any)?.email);
      if (!email) return ctx.badRequest('Please enter a valid email address.');
      ctx.body = { subscribed: await isActiveSubscriber(strapi, email) };
    },

    // Subscribes the visitor to the Substack (free tier) from our own pop-up,
    // and counts them as a subscriber straight away.
    async subscribe(ctx) {
      const email = normalizeEmail((ctx.request.body as any)?.email);
      if (!email) return ctx.badRequest('Please enter a valid email address.');

      if (await isActiveSubscriber(strapi, email)) {
        ctx.body = { subscribed: true };
        return;
      }
      const ok = await subscribeOnSubstack(email);
      if (!ok) {
        strapi.log.warn(`[substack] On-site subscribe was refused for ${email}`);
        ctx.body = { subscribed: false, subscribeUrl: substackSubscribeUrl(email) };
        return;
      }
      await upsertSubscribers(strapi, [email], 'site');
      strapi.log.info(`[substack] ${email} subscribed from the website`);
      ctx.body = { subscribed: true };
    },
  })
);
