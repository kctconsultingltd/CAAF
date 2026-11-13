import { factories } from '@strapi/strapi';
import { isPaidSubscriber, normalizeEmail } from '../../../utils/substack';
import { sendBookEmail } from '../../../utils/resource-mailer';

export default factories.createCoreController('api::resource.resource', ({ strapi }) => ({
  // Emails the book to the address given (which proves the address is real).
  // Free books go to anyone; paid books go free to paid Substack subscribers.
  // The file field is private and its URL is never returned to the browser.
  async download(ctx) {
    const { documentId } = ctx.params;
    const email = normalizeEmail((ctx.request.body as any)?.email);
    if (!email) return ctx.badRequest('Please enter a valid email address.');

    const resource: any = await strapi
      .documents('api::resource.resource')
      .findOne({ documentId, populate: ['file'] });
    if (!resource || !resource.file?.url) {
      return ctx.notFound('This book is not available yet.');
    }

    const viaSubscription = resource.access !== 'free';
    if (viaSubscription && !(await isPaidSubscriber(strapi, email))) {
      return ctx.forbidden('This book is free for paid Substack subscribers.');
    }

    try {
      await sendBookEmail(strapi, email, resource, resource.file, viaSubscription);
    } catch (err: any) {
      strapi.log.error(`[resource-download] Email to ${email} failed: ${err.message}`);
      ctx.status = 502;
      ctx.body = {
        error: { status: 502, name: 'EmailError', message: "We couldn't send the email. Try again in a minute." },
      };
      return;
    }

    await strapi.documents('api::resource-download.resource-download').create({
      data: { email, resource: documentId, resourceTitle: resource.title, viaSubscription } as any,
    });
    strapi.log.info(`[resource-download] Sent "${resource.title}" to ${email}${viaSubscription ? ' (subscriber)' : ''}`);

    ctx.body = { sent: true };
  },
}));
