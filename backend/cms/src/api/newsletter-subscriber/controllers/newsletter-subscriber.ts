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
        strapi.log.info(`[newsletter-subscriber] duplicate or error for: ${email}, proceeding`);
      }

      ctx.body = { ok: true };
    },

    async exportCsv(ctx) {
      const key = String(ctx.query.key ?? '');
      const exportKey = process.env.EXPORT_KEY;

      if (!exportKey || key !== exportKey) {
        ctx.status = 401;
        ctx.body = 'Unauthorized';
        return;
      }

      const source = String(ctx.query.source ?? '');
      const filters: Record<string, any> = source ? { source } : {};

      const entries = await (strapi.documents as any)(
        'api::newsletter-subscriber.newsletter-subscriber'
      ).findMany({ filters, sort: { createdAt: 'desc' }, pagination: { limit: 10000 } });

      const rows = [['Email', 'Source', 'Date']];
      for (const e of entries) {
        rows.push([
          e.email ?? '',
          e.source ?? '',
          e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
        ]);
      }

      const csv = rows
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set('Content-Disposition', `attachment; filename="subscribers-${Date.now()}.csv"`);
      ctx.body = csv;
    },
  })
);
