import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::newsletter-subscriber.newsletter-subscriber' as any,
  ({ strapi }) => ({
    async create(ctx) {
      const body = ctx.request.body as Record<string, any>;
      const email = String(body.email ?? '').trim().toLowerCase();
      const source = String(body.source ?? '').trim();

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) return ctx.badRequest('Invalid email address.');

      try {
        await (strapi.documents as any)('api::newsletter-subscriber.newsletter-subscriber').create({
          data: { email, source: source || undefined },
        });
        strapi.log.info(`[newsletter-subscriber] saved: ${email} | source: ${source || 'none'}`);
      } catch {
        // Duplicate email — already stored, proceed silently
        strapi.log.info(`[newsletter-subscriber] duplicate or error for: ${email}, proceeding`);
      }

      ctx.body = { ok: true };
    },
  })
);
