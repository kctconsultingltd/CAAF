import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::resource-download.resource-download',
  ({ strapi }) => ({
    async exportCsv(ctx) {
      const key = String(ctx.query.key ?? '');
      const exportKey = process.env.EXPORT_KEY;
      if (!exportKey || key !== exportKey) {
        ctx.status = 401;
        ctx.body = 'Unauthorized';
        return;
      }

      const entries: any[] = await strapi
        .documents('api::resource-download.resource-download')
        .findMany({ sort: ['createdAt:desc'], limit: 10000 } as any);

      const rows = [['Email', 'Resource', 'Subscriber', 'Date']];
      for (const e of entries ?? []) {
        rows.push([
          e.email ?? '',
          e.resourceTitle ?? '',
          e.viaSubscription ? 'Yes' : 'No',
          e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
        ]);
      }
      // Leading = + - @ would run as a formula when the CSV is opened in Excel.
      const cell = (v: string) => {
        const safe = /^[=+\-@]/.test(v) ? "'" + v : v;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const csv = rows
        .map((r) => r.map((v) => cell(String(v))).join(','))
        .join('\n');

      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set('Content-Disposition', `attachment; filename="book-downloads-${Date.now()}.csv"`);
      ctx.body = csv;
    },
  })
);
