import { factories } from '@strapi/strapi';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export default factories.createCoreController(
  'api::pitch-submission.pitch-submission' as any,
  ({ strapi }) => ({
    async create(ctx) {
      const body = ctx.request.body as Record<string, any>;

      // ── Locate uploaded files (koa-body puts them on ctx.request.files;
      //    some Strapi builds also expose them on ctx.files) ──────────────
      const reqFiles  = (ctx.request as any).files as Record<string, any> | undefined;
      const ctxFiles  = (ctx        as any).files as Record<string, any> | undefined;
      const files     = reqFiles ?? ctxFiles ?? {};

      strapi.log.info(
        `[pitch-submission] body keys: ${Object.keys(body).join(', ')}` +
        ` | file keys: ${Object.keys(files).join(', ') || 'none'}` +
        ` | content-type: ${ctx.request.headers['content-type']?.split(';')[0]}` +
        ` | cloudinary: ${process.env.CLOUDINARY_NAME ? 'configured' : 'NOT configured'}`
      );

      // ── Validation ────────────────────────────────────────────────────
      const required = ['fullName', 'email', 'businessName', 'dealDescription', 'fundingRequest'] as const;
      const missing  = required.filter((f) => !String(body[f] ?? '').trim());
      if (missing.length > 0) return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(body.email)) return ctx.badRequest('Invalid email address.');

      // ── Deck file upload ───────────────────────────────────────────────
      let deckId: number | undefined;
      let deckUrl: string | undefined;
      let tmpPath: string | undefined;

      const rawDeck = files['deck'] ?? files['files.deck'];
      strapi.log.info(`[pitch-submission] rawDeck present: ${!!rawDeck}`);

      if (rawDeck) {
        const deckFile = Array.isArray(rawDeck) ? rawDeck[0] : rawDeck;

        // formidable v3 uses .filepath; v1/v2 uses .path
        const srcPath: string | undefined = deckFile.filepath ?? deckFile.path;
        const fileName = deckFile.originalFilename ?? deckFile.name ?? 'deck';
        const mimeType = deckFile.mimetype ?? deckFile.type ?? 'application/octet-stream';
        const fileSize = Number(deckFile.size ?? 0);

        strapi.log.info(
          `[pitch-submission] deck — srcPath: ${srcPath}, name: ${fileName}, ` +
          `mime: ${mimeType}, size: ${fileSize}, exists: ${srcPath ? fs.existsSync(srcPath) : false}`
        );

        // Copy to a named temp file so Strapi's upload service gets the right extension
        if (srcPath && fs.existsSync(srcPath) && fileSize > 0) {
          try {
            const ext    = path.extname(fileName) || '.pdf';
            tmpPath      = path.join(os.tmpdir(), `pitch-deck-${Date.now()}${ext}`);
            fs.copyFileSync(srcPath, tmpPath);

            // Strapi v5 upload service calls file.getStream() internally (formidable v3
            // style) — provide it explicitly so it doesn't fall back to this.filepath
            // which would be undefined on a plain descriptor object.
            const [uploaded] = await strapi.plugin('upload').service('upload').upload({
              data: {},
              files: {
                path: tmpPath,
                filepath: tmpPath,
                name: fileName,
                originalFilename: fileName,
                type: mimeType,
                mimetype: mimeType,
                size: fileSize,
                getStream: () => fs.createReadStream(tmpPath),
              },
            });
            deckId  = uploaded.id;
            deckUrl = uploaded.url;
            strapi.log.info(`[pitch-submission] deck uploaded — id: ${deckId}, url: ${deckUrl}`);
          } catch (err: any) {
            strapi.log.error(`[pitch-submission] deck upload error: ${err.message}\n${err.stack ?? ''}`);
          } finally {
            if (tmpPath) try { fs.unlinkSync(tmpPath); } catch {}
          }
        }
      }

      // ── Persist submission ────────────────────────────────────────────
      const entry = await (strapi.documents as any)('api::pitch-submission.pitch-submission').create({
        data: {
          fullName:        String(body.fullName).trim(),
          email:           String(body.email).trim().toLowerCase(),
          phone:           String(body.phone ?? '').trim() || null,
          businessName:    String(body.businessName).trim(),
          dealDescription: String(body.dealDescription).trim(),
          currentTurnover: String(body.currentTurnover ?? '').trim() || null,
          fundingRequest:  String(body.fundingRequest).trim(),
          ...(deckId !== undefined ? { deck: deckId } : {}),
        },
      });

      // ── Notify admin (fire-and-forget) ────────────────────────────────
      const svc = strapi.service('api::pitch-submission.pitch-submission') as {
        notifyAdmin: (p: object) => Promise<void>;
      };
      const adminBase = process.env.ADMIN_URL ?? 'https://admin-staging.capitalasaforce.com';
      svc
        .notifyAdmin({
          fullName:        String(body.fullName).trim(),
          email:           String(body.email).trim(),
          phone:           String(body.phone ?? '').trim() || null,
          businessName:    String(body.businessName).trim(),
          dealDescription: String(body.dealDescription).trim(),
          currentTurnover: String(body.currentTurnover ?? '').trim() || null,
          fundingRequest:  String(body.fundingRequest).trim(),
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
