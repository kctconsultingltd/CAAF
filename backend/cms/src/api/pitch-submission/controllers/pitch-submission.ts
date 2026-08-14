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

        // Upload directly to Cloudinary as resource_type:'raw' so PDFs are
        // stored and served as downloadable files, not converted to images.
        if (srcPath && fs.existsSync(srcPath) && fileSize > 0) {
          try {
            const ext = path.extname(fileName) || '.pdf';
            tmpPath   = path.join(os.tmpdir(), `pitch-deck-${Date.now()}${ext}`);
            fs.copyFileSync(srcPath, tmpPath);

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const cloudinaryV2 = require('cloudinary').v2;
            cloudinaryV2.config({
              cloud_name: process.env.CLOUDINARY_NAME,
              api_key:    process.env.CLOUDINARY_KEY,
              api_secret: process.env.CLOUDINARY_SECRET,
            });

            const result = await cloudinaryV2.uploader.upload(tmpPath, {
              resource_type: 'raw',
              use_filename: true,
              unique_filename: true,
              filename_override: fileName,
            });

            deckUrl = result.secure_url;
            strapi.log.info(`[pitch-submission] deck uploaded — url: ${deckUrl}`);
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
          ...(deckUrl ? { deckUrl } : {}),
        },
      });

      // ── Notify admin (fire-and-forget) ────────────────────────────────
      const svc = strapi.service('api::pitch-submission.pitch-submission') as {
        notifyAdmin: (p: object) => Promise<void>;
      };
      svc
        .notifyAdmin({
          fullName:        String(body.fullName).trim(),
          email:           String(body.email).trim(),
          phone:           String(body.phone ?? '').trim() || null,
          businessName:    String(body.businessName).trim(),
          dealDescription: String(body.dealDescription).trim(),
          currentTurnover: String(body.currentTurnover ?? '').trim() || null,
          fundingRequest:  String(body.fundingRequest).trim(),
        })
        .catch((err: Error) =>
          strapi.log.error('[pitch-submission] Admin notification failed:', err.message)
        );

      ctx.body = {
        data: { documentId: entry.documentId ?? null },
        message: 'Your pitch has been received. We will review it and be in touch.',
      };
    },

    async exportData(ctx) {
      const key = String(ctx.query.key ?? '');
      const exportKey = process.env.EXPORT_KEY;

      strapi.log.info(
        `[pitch-submission] exportData — exportKey:${exportKey ? 'SET(len=' + exportKey.length + ')' : 'MISSING'} | key len:${key.length}`
      );

      if (!exportKey) {
        ctx.status = 401;
        ctx.body = 'EXPORT_KEY is not configured on the server';
        return;
      }
      if (key !== exportKey) {
        ctx.status = 401;
        ctx.body = 'Invalid export key';
        return;
      }

      const entries = await (strapi.documents as any)(
        'api::pitch-submission.pitch-submission'
      ).findMany({
        sort: ['createdAt:desc'],
        limit: 10000,
      });

      strapi.log.info(`[pitch-submission] export — found ${entries?.length ?? 0} entries`);

      const format = String(ctx.query.format ?? 'json');

      if (format === 'csv') {
        const header = ['Date', 'Full Name', 'Email', 'Phone', 'Business', 'Funding Request', 'Current Turnover', 'Deal Description', 'Deck URL'];
        const rows = [header];
        for (const e of (entries ?? [])) {
          const deckUrl = e.deckUrl ?? '';
          rows.push([
            e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
            e.fullName ?? '',
            e.email ?? '',
            e.phone ?? '',
            e.businessName ?? '',
            e.fundingRequest ?? '',
            e.currentTurnover ?? '',
            e.dealDescription ?? '',
            deckUrl,
          ]);
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        ctx.set('Content-Type', 'text/csv; charset=utf-8');
        ctx.set('Content-Disposition', `attachment; filename="pitch-submissions-${Date.now()}.csv"`);
        ctx.body = csv;
        return;
      }

      // JSON response for the table view
      ctx.body = (entries ?? []).map((e: any) => ({
        date:            e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
        fullName:        e.fullName ?? '',
        email:           e.email ?? '',
        phone:           e.phone ?? '',
        businessName:    e.businessName ?? '',
        fundingRequest:  e.fundingRequest ?? '',
        currentTurnover: e.currentTurnover ?? '',
        dealDescription: e.dealDescription ?? '',
        deckUrl: e.deckUrl ?? '',
      }));
    },
  })
);
