// Everything to do with knowing who subscribes to the CAAF Substack.
//
// Substack has no webhooks and no public subscriber API, so the list is kept
// in our own "Substack Subscriber" collection, fed from three places:
//   1. syncSubstackSubscribers(): every 6h, reads the dashboard's subscriber
//      list using the publication owner's login cookie (SUBSTACK_COOKIE).
//   2. importSubscriberCsv(): an admin uploads Substack's CSV export.
//   3. The website pop-up: people who subscribe through it are added at once.

const UID = 'api::substack-subscriber.substack-subscriber';
const IMPORT_UID = 'api::substack-import.substack-import';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 100;
// A sync that suddenly sees far fewer subscribers is more likely a broken
// response than a mass unsubscribe, so it doesn't mark anyone unsubscribed.
const MIN_SYNC_RATIO = 0.8;
// People who subscribed through our pop-up may take a while to show up in the
// dashboard list; don't unsubscribe them in the meantime.
const SITE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export type SubscriberSource = 'sync' | 'csv' | 'site' | 'admin';

export function publicationHost(): string {
  return (process.env.SUBSTACK_PUBLICATION || 'tochukwuezeukwu.substack.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

export function substackSubscribeUrl(email?: string): string {
  const base = `https://${publicationHost()}/subscribe`;
  return email ? `${base}?email=${encodeURIComponent(email)}` : base;
}

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export async function isActiveSubscriber(strapi: any, email: string): Promise<boolean> {
  const row = await strapi.db.query(UID).findOne({ where: { email, status: 'active' }, select: ['id'] });
  return !!row;
}

/** Adds or reactivates subscribers. */
export async function upsertSubscribers(
  strapi: any,
  emails: string[],
  source: SubscriberSource
): Promise<{ added: number; reactivated: number; unchanged: number }> {
  const unique = [...new Set(emails.map(normalizeEmail).filter((e): e is string => !!e))];
  const existing: any[] = [];
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    existing.push(
      ...(await strapi.db.query(UID).findMany({ where: { email: { $in: chunk } }, select: ['id', 'email', 'status'] }))
    );
  }
  const byEmail = new Map(existing.map((r) => [r.email, r]));
  const now = new Date();
  let added = 0;
  let reactivated = 0;
  let unchanged = 0;

  for (const email of unique) {
    const row = byEmail.get(email);
    if (!row) {
      // Created through the document service so the entry gets a documentId
      // and shows up normally in the admin.
      await strapi.documents(UID).create({ data: { email, status: 'active', source, lastSeenAt: now } });
      added++;
    } else {
      await strapi.db.query(UID).update({ where: { id: row.id }, data: { status: 'active', lastSeenAt: now } });
      if (row.status === 'active') unchanged++;
      else reactivated++;
    }
  }
  return { added, reactivated, unchanged };
}

// ── On-site subscribe ──────────────────────────────────────────────────────

/** Signs the email up to the free tier, the same way Substack's embed form does. */
export async function subscribeOnSubstack(email: string): Promise<boolean> {
  const host = publicationHost();
  try {
    const res = await fetch(`https://${host}/api/v1/free?nojs=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
        Origin: `https://${host}`,
        Referer: `https://${host}/subscribe`,
      },
      body: JSON.stringify({
        email,
        first_url: `https://${host}/subscribe`,
        current_url: `https://${host}/subscribe`,
        source: 'subscribe_page',
      }),
    });
    if (!res.ok) return false;
    const body: any = await res.json().catch(() => ({}));
    return !(body?.errors || body?.error || body?.requires_captcha);
  } catch {
    return false;
  }
}

// ── Dashboard sync ─────────────────────────────────────────────────────────

/** Accepts a full cookie header ("connect.sid=…; substack.sid=…") or a bare substack.sid value. */
function cookieHeader(raw: string): string {
  const v = raw.trim();
  if (v.includes('=')) return v;
  return `substack.sid=${v}; connect.sid=${v}`;
}

export class SubstackAuthError extends Error {}

async function fetchSubscriberPage(
  cookie: string,
  offset: number
): Promise<{ emails: string[]; count: number | null; size: number }> {
  const host = publicationHost();
  const res = await fetch(`https://${host}/api/v1/subscriber-stats`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': BROWSER_UA,
      Origin: `https://${host}`,
      Referer: `https://${host}/publish/subscribers`,
    },
    body: JSON.stringify({
      filters: { order_by_desc_nulls_last: 'subscription_created_at' },
      limit: PAGE_SIZE,
      offset,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new SubstackAuthError(`Substack refused the login cookie (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`Substack subscriber list failed: HTTP ${res.status}`);
  const body: any = await res.json();
  const list: any[] | null = Array.isArray(body?.subscribers) ? body.subscribers : Array.isArray(body) ? body : null;
  if (!list) throw new Error('Unexpected subscriber list format from Substack');

  const emails = list
    // is_subscribed is missing on some accounts; only an explicit false excludes.
    .filter((s) => s?.is_subscribed !== false)
    .map((s) => normalizeEmail(s?.user_email_address ?? s?.email))
    .filter((e): e is string => !!e);
  const count = Number.isFinite(Number(body?.count)) ? Number(body.count) : null;
  return { emails, count, size: list.length };
}

export interface SyncResult {
  skipped?: string;
  seen: number;
  added: number;
  reactivated: number;
  unsubscribed: number;
  unsubscribeSkipped?: string;
}

export async function syncSubstackSubscribers(strapi: any): Promise<SyncResult> {
  const raw = process.env.SUBSTACK_COOKIE || process.env.SUBSTACK_SID;
  if (!raw) return { skipped: 'SUBSTACK_COOKIE is not set', seen: 0, added: 0, reactivated: 0, unsubscribed: 0 };
  const cookie = cookieHeader(raw);

  const seen = new Set<string>();
  let offset = 0;
  let total: number | null = null;
  for (let pageNo = 0; pageNo < 1000; pageNo++) {
    const page = await fetchSubscriberPage(cookie, offset);
    if (total === null) total = page.count;
    page.emails.forEach((e) => seen.add(e));
    offset += page.size;
    if (page.size < PAGE_SIZE || (total !== null && offset >= total)) break;
    await new Promise((r) => setTimeout(r, 1200)); // stay well under Substack's rate limit
  }

  const { added, reactivated } = await upsertSubscribers(strapi, [...seen], 'sync');

  // Mark people no longer on the list as unsubscribed, guarded against
  // partial or broken responses.
  const active: any[] = await strapi.db.query(UID).findMany({
    where: { status: 'active' },
    select: ['id', 'email', 'source', 'createdAt'],
  });
  const previousActive = active.length - added - reactivated;
  const now = Date.now();
  const missing = active.filter(
    (r) => !seen.has(r.email) && !(r.source === 'site' && now - new Date(r.createdAt).getTime() < SITE_GRACE_MS)
  );

  let unsubscribed = 0;
  let unsubscribeSkipped: string | undefined;
  if (missing.length) {
    if (seen.size === 0 || seen.size < previousActive * MIN_SYNC_RATIO) {
      unsubscribeSkipped =
        `Substack returned ${seen.size} subscribers but ${previousActive} were active here, ` +
        'so nobody was marked unsubscribed';
    } else {
      for (const r of missing) {
        await strapi.db.query(UID).update({ where: { id: r.id }, data: { status: 'unsubscribed' } });
        unsubscribed++;
      }
    }
  }

  return { seen: seen.size, added, reactivated, unsubscribed, unsubscribeSkipped };
}

// ── CSV import ─────────────────────────────────────────────────────────────

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Runs after a Substack CSV Import entry is saved. Never throws. */
export async function importSubscriberCsv(strapi: any, documentId: string): Promise<void> {
  let entry: any;
  try {
    entry = await strapi.db.query(IMPORT_UID).findOne({ where: { documentId }, populate: ['file'] });
    if (!entry?.file || entry.file.id === entry.importedFileId) return;

    const res = await fetch(entry.file.url);
    if (!res.ok) throw new Error(`could not download the file (HTTP ${res.status})`);
    const rows = parseCsv(await res.text());
    if (!rows.length) throw new Error('the file is empty');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    let col = header.findIndex((h) => h === 'email' || h === 'email address' || h === 'user_email_address');
    let dataRows = rows.slice(1);
    if (col === -1) {
      // No header we recognise: use the first column that holds an email.
      col = rows[0].findIndex((v) => !!normalizeEmail(v));
      dataRows = rows;
    }
    if (col === -1) throw new Error('no "email" column found');

    const emails = dataRows.map((r) => r[col]).filter((v) => v && v.trim());
    const valid = emails.map(normalizeEmail).filter((e): e is string => !!e);
    const { added, reactivated, unchanged } = await upsertSubscribers(strapi, valid, 'csv');
    const invalid = emails.length - valid.length;

    const summary =
      `Imported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC: ` +
      `${added} new, ${reactivated} reactivated, ${unchanged} already present` +
      (invalid ? `, ${invalid} rows skipped (not a valid email)` : '') +
      '.';
    await strapi.db.query(IMPORT_UID).update({ where: { id: entry.id }, data: { summary, importedFileId: entry.file.id } });
    strapi.log.info(`[substack-csv] ${summary}`);
  } catch (err: any) {
    strapi.log.error(`[substack-csv] Import failed: ${err.message}`);
    if (entry?.id) {
      await strapi.db
        .query(IMPORT_UID)
        .update({ where: { id: entry.id }, data: { summary: `Import failed: ${err.message}` } })
        .catch(() => {});
    }
  }
}
