import { factories } from '@strapi/strapi';
import * as fs from 'fs';

export default factories.createCoreController(
  'api::pitch-submission.pitch-submission' as any,
  ({ strapi }) => ({
    async create(ctx) {
      const body = ctx.request.body as Record<string, any>;

      const reqFiles = (ctx.request as any).files as Record<string, any> | undefined;
      const ctxFiles = (ctx as any).files as Record<string, any> | undefined;
      const files    = reqFiles ?? ctxFiles ?? {};

      strapi.log.info(
        `[pitch-submission] body keys: ${Object.keys(body).join(', ')}` +
        ` | file keys: ${Object.keys(files).join(', ') || 'none'}` +
        ` | content-type: ${ctx.request.headers['content-type']?.split(';')[0]}`
      );

      // ── Validation ────────────────────────────────────────────────────
      const required = ['fullName', 'email', 'businessName', 'dealDescription', 'fundingRequest'] as const;
      const missing  = required.filter((f) => !String(body[f] ?? '').trim());
      if (missing.length > 0) return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(body.email)) return ctx.badRequest('Invalid email address.');

      // ── Deck file → base64 ────────────────────────────────────────────
      let deckData:     string | undefined;
      let deckFileName: string | undefined;
      let deckMimeType: string | undefined;

      const rawDeck = files['deck'] ?? files['files.deck'];
      strapi.log.info(`[pitch-submission] rawDeck present: ${!!rawDeck}`);

      if (rawDeck) {
        const deckFile = Array.isArray(rawDeck) ? rawDeck[0] : rawDeck;
        const srcPath: string | undefined = deckFile.filepath ?? deckFile.path;
        const fileSize = Number(deckFile.size ?? 0);

        strapi.log.info(
          `[pitch-submission] deck — srcPath: ${srcPath}, size: ${fileSize}, ` +
          `exists: ${srcPath ? fs.existsSync(srcPath) : false}`
        );

        if (srcPath && fs.existsSync(srcPath) && fileSize > 0) {
          try {
            deckData     = fs.readFileSync(srcPath).toString('base64');
            deckFileName = deckFile.originalFilename ?? deckFile.name ?? 'deck.pdf';
            deckMimeType = deckFile.mimetype ?? deckFile.type ?? 'application/pdf';
            strapi.log.info(`[pitch-submission] deck read — ${fileSize} bytes, mime: ${deckMimeType}`);
          } catch (err: any) {
            strapi.log.error(`[pitch-submission] deck read error: ${err.message}`);
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
          ...(deckData ? { deckData, deckFileName, deckMimeType, hasDeck: true } : {}),
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

    // ── Serve a single deck as binary PDF ─────────────────────────────
    async serveDeck(ctx) {
      const key       = String(ctx.query.key ?? '');
      const exportKey = process.env.EXPORT_KEY;

      if (!exportKey) { ctx.status = 401; ctx.body = 'EXPORT_KEY is not configured'; return; }
      if (key !== exportKey) { ctx.status = 401; ctx.body = 'Invalid export key'; return; }

      const docId = ctx.params.id;
      const entry = await (strapi.documents as any)('api::pitch-submission.pitch-submission')
        .findOne(docId, { fields: ['deckData', 'deckFileName', 'deckMimeType'] });

      if (!entry?.deckData) { ctx.status = 404; ctx.body = 'No deck found'; return; }

      const buffer = Buffer.from(entry.deckData, 'base64');
      const mime   = entry.deckMimeType || 'application/pdf';
      const name   = entry.deckFileName || 'deck.pdf';

      ctx.set('Content-Type', mime);
      ctx.set('Content-Disposition', `inline; filename="${name}"`);
      ctx.set('Content-Length', String(buffer.length));
      ctx.body = buffer;
    },

    // ── Export all submissions (metadata only, no binary) ─────────────
    async exportData(ctx) {
      const key       = String(ctx.query.key ?? '');
      const exportKey = process.env.EXPORT_KEY;

      strapi.log.info(
        `[pitch-submission] exportData — exportKey:${exportKey ? 'SET(len=' + exportKey.length + ')' : 'MISSING'} | key len:${key.length}`
      );

      if (!exportKey) { ctx.status = 401; ctx.body = 'EXPORT_KEY is not configured on the server'; return; }
      if (key !== exportKey) { ctx.status = 401; ctx.body = 'Invalid export key'; return; }

      const entries = await (strapi.documents as any)(
        'api::pitch-submission.pitch-submission'
      ).findMany({
        sort:   ['createdAt:desc'],
        limit:  10000,
        fields: ['fullName', 'email', 'phone', 'businessName', 'fundingRequest',
                 'currentTurnover', 'dealDescription', 'hasDeck', 'deckFileName', 'createdAt'],
      });

      strapi.log.info(`[pitch-submission] export — found ${entries?.length ?? 0} entries`);

      const format = String(ctx.query.format ?? 'json');

      if (format === 'csv') {
        const header = ['Date','Full Name','Email','Phone','Business','Funding Request','Current Turnover','Deal Description','Has Deck','Deck File'];
        const rows   = [header];
        for (const e of (entries ?? [])) {
          rows.push([
            e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
            e.fullName        ?? '',
            e.email           ?? '',
            e.phone           ?? '',
            e.businessName    ?? '',
            e.fundingRequest  ?? '',
            e.currentTurnover ?? '',
            e.dealDescription ?? '',
            e.hasDeck ? 'Yes' : 'No',
            e.deckFileName    ?? '',
          ]);
        }
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        ctx.set('Content-Type', 'text/csv; charset=utf-8');
        ctx.set('Content-Disposition', `attachment; filename="pitch-submissions-${Date.now()}.csv"`);
        ctx.body = csv;
        return;
      }

      ctx.body = (entries ?? []).map((e: any) => ({
        id:              e.documentId ?? '',
        date:            e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '',
        fullName:        e.fullName        ?? '',
        email:           e.email           ?? '',
        phone:           e.phone           ?? '',
        businessName:    e.businessName    ?? '',
        fundingRequest:  e.fundingRequest  ?? '',
        currentTurnover: e.currentTurnover ?? '',
        dealDescription: e.dealDescription ?? '',
        hasDeck:         e.hasDeck         ?? false,
        deckFileName:    e.deckFileName    ?? '',
      }));
    },
  })
);
