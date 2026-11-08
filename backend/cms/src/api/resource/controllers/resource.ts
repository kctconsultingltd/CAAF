import { factories } from '@strapi/strapi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default factories.createCoreController('api::resource.resource', ({ strapi }) => ({
  // Free books: record the email, then hand back the file URL (the file field
  // is private, so this is the only way the public gets it).
  async download(ctx) {
    const { documentId } = ctx.params;
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return ctx.badRequest('Please enter a valid email address.');
    }

    const resource: any = await strapi
      .documents('api::resource.resource')
      .findOne({ documentId, populate: ['file'] });
    if (!resource || resource.access !== 'free' || !resource.file?.url) {
      return ctx.notFound('This resource is not available for download.');
    }

    await strapi.documents('api::resource-download.resource-download').create({
      data: { email, resource: documentId, resourceTitle: resource.title } as any,
    });
    strapi.log.info(`[resource-download] ${email} -> ${resource.title}`);

    ctx.body = { url: resource.file.url, filename: resource.file.name };
  },
}));
