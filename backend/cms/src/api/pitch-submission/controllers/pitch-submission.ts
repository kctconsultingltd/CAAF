import { factories } from '@strapi/strapi';
import * as fs from 'fs';

export default factories.createCoreController(
  'api::pitch-submission.pitch-submission' as any,
  ({ strapi }) => ({
    async create(ctx) {
      const body  = ctx.request.body  as Record<string, string>;
      const files = (ctx.request as any).files as Record<string, any> | undefined;

      const required = ['fullName', 'email', 'businessName', 'dealDescription', 'fundingRequest'] as const;
      const missing  = required.filter((f) => !body[f]?.trim());
      if (missing.length > 0) {
        return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
      }

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(body.email)) {
        return ctx.badRequest('Invalid email address.');
      }

      // Upload deck file if provided
      let deckId: number | undefined;
      let deckUrl: string | undefined;
      const rawDeck = files?.deck;
      if (rawDeck) {
        const deckFile = Array.isArray(rawDeck) ? rawDeck[0] : rawDeck;
        const filePath = deckFile.path ?? deckFile.filepath;
        if (filePath && fs.existsSync(filePath)) {
          try {
            const [uploaded] = await strapi.plugin('upload').service('upload').upload({
              data: {},
              files: {
                path: filePath,
                name: deckFile.name ?? deckFile.originalFilename ?? 'deck',
                type: deckFile.type ?? deckFile.mimetype ?? 'application/octet-stream',
                size: deckFile.size,
              },
            });
            deckId  = uploaded.id;
            deckUrl = uploaded.url;
          } catch (err: any) {
            strapi.log.warn(`[pitch-submission] Deck upload failed: ${err.message}`);
          }
        }
      }

      const entry = await (strapi.documents as any)('api::pitch-submission.pitch-submission').create({
        data: {
          fullName:        body.fullName.trim(),
          email:           body.email.trim().toLowerCase(),
          phone:           body.phone?.trim() || null,
          businessName:    body.businessName.trim(),
          dealDescription: body.dealDescription.trim(),
          currentTurnover: body.currentTurnover?.trim() || null,
          fundingRequest:  body.fundingRequest.trim(),
          ...(deckId !== undefined ? { deck: deckId } : {}),
        },
      });

      const svc = strapi.service('api::pitch-submission.pitch-submission') as {
        notifyAdmin: (p: object) => Promise<void>;
      };

      const adminBase = process.env.ADMIN_URL ?? 'https://admin-staging.capitalasaforce.com';
      svc
        .notifyAdmin({
          fullName:        body.fullName.trim(),
          email:           body.email.trim(),
          phone:           body.phone?.trim() || null,
          businessName:    body.businessName.trim(),
          dealDescription: body.dealDescription.trim(),
          currentTurnover: body.currentTurnover?.trim() || null,
          fundingRequest:  body.fundingRequest.trim(),
          deckUrl:         deckUrl ? adminBase + deckUrl : null,
        })
        .catch((err: Error) =>
          strapi.log.error('[pitch-submission] Admin notification failed:', err.message)
        );

      ctx.body = {
        data: { documentId: entry.documentId ?? null },
        message: 'Your pitch has been received. We will review it and be in touch.',
      };
    },
  })
);
