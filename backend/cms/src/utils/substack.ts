// Everything to do with knowing who subscribes to the CAAF Substack, and on
// which plan. Paid subscribers get every book free; free-plan subscribers
// are recorded too, so the site can tell them to upgrade.
//
// Substack has no webhooks and no public subscriber API, so the list is kept
// in our own "Substack Subscriber" collection, fed from two places:
//   1. syncSubstackSubscribers(): every 6h, reads the dashboard's subscriber
//      list using the publication owner's login cookie (SUBSTACK_COOKIE).
//   2. importSubscriberCsv(): an admin uploads Substack's CSV export.

const UID = 'api::substack-subscriber.substack-subscriber';
const IMPORT_UID = 'api::substack-import.substack-import';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 100;
// A sync that suddenly sees far fewer subscribers is more likely a broken
// response than a mass unsubscribe, so it doesn't mark anyone unsubscribed.
const MIN_SYNC_RATIO = 0.8;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export type SubscriberSource = 'sync' | 'csv' | 'admin';
export type Plan = 'free' | 'paid';

/** `paid` undefined means "plan unknown": keep what we already have (new rows default to free). */
export interface SubscriberEntry {
  email: string;
  paid?: boolean;
}

export function publicationHost(): string {
  return (process.env.SUBSTACK_PUBLICATION || 'tochukwuezeukwu.substack.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** Active subscriber's plan, or null when the email isn't an active subscriber. */
export async function subscriberPlan(strapi: any, email: string): Promise<Plan | null> {
  const row = await strapi.db.query(UID).findOne({ where: { email, status: 'active' }, select: ['plan'] });
  return row ? (row.plan === 'paid' ? 'paid' : 'free') : null;
}

export async function isPaidSubscriber(strapi: any, email: string): Promise<boolean> {
  return (await subscriberPlan(strapi, email)) === 'paid';
}

/** Adds or reactivates subscribers and records their plan. */
export async function upsertSubscribers(
  strapi: any,
  entries: SubscriberEntry[],
  source: SubscriberSource
): Promise<{ added: number; reactivated: number; unchanged: number; planChanged: number }> {
  // Dedupe; if an email appears twice, any paid row wins.
  const wanted = new Map<string, boolean | undefined>();
  for (const e of entries) {
    const email = normalizeEmail(e.email);
    if (!email) continue;
    const prev = wanted.get(email);
    wanted.set(email, prev === true || e.paid === true ? true : e.paid ?? prev);
  }
  const emails = [...wanted.keys()];
  const existing: any[] = [];
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    existing.push(
      ...(await strapi.db
        .query(UID)
        .findMany({ where: { email: { $in: chunk } }, select: ['id', 'email', 'status', 'plan'] }))
    );
  }
  const byEmail = new Map(existing.map((r) => [r.email, r]));
  const now = new Date();
  let added = 0;
  let reactivated = 0;
  let unchanged = 0;
  let planChanged = 0;

  for (const [email, paid] of wanted) {
    const row = byEmail.get(email);
    if (!row) {
      // Created through the document service so the entry gets a documentId
      // and shows up normally in the admin.
      await strapi
        .documents(UID)
        .create({ data: { email, status: 'active', plan: paid ? 'paid' : 'free', source, lastSeenAt: now } });
      added++;
      continue;
    }
    const data: Record<string, unknown> = { status: 'active', lastSeenAt: now };
    if (paid !== undefined) {
      const plan: Plan = paid ? 'paid' : 'free';
      if (plan !== row.plan) planChanged++;
      data.plan = plan;
    }
    await strapi.db.query(UID).update({ where: { id: row.id }, data });
    if (row.status === 'active') unchanged++;
    else reactivated++;
  }
  return { added, reactivated, unchanged, planChanged };
}

// ── Dashboard sync ─────────────────────────────────────────────────────────

/** Accepts a full cookie header ("connect.sid=…; substack.sid=…") or a bare substack.sid value. */
function cookieHeader(raw: string): string {
  const v = raw.trim();
  if (v.includes('=')) return v;
  return `substack.sid=${v}; connect.sid=${v}`;
}

export class SubstackAuthError extends Error {}

/** Paid access per the dashboard: a paid billing interval, or comp/gift/founding. */
export function isPaidRecord(s: any): boolean {
  const interval = String(s?.subscription_interval ?? '').trim().toLowerCase();
  return (!!interval && interval !== 'free') || s?.is_comp === true || s?.is_gift === true || s?.is_founding === true;
}

async function fetchSubscriberPage(
  cookie: string,
  offset: number
): Promise<{ entries: SubscriberEntry[]; count: number | null; size: number }> {
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

  const entries: SubscriberEntry[] = [];
  for (const s of list) {
    // is_subscribed is missing on some accounts; only an explicit false excludes.
    if (s?.is_subscribed === false) continue;
    const email = normalizeEmail(s?.user_email_address ?? s?.email);
    if (email) entries.push({ email, paid: isPaidRecord(s) });
  }
  const count = Number.isFinite(Number(body?.count)) ? Number(body.count) : null;
  return { entries, count, size: list.length };
}

export interface SyncResult {
  skipped?: string;
  seen: number;
  paid: number;
  added: number;
  reactivated: number;
  planChanged: number;
  unsubscribed: number;
  unsubscribeSkipped?: string;
}

export async function syncSubstackSubscribers(strapi: any): Promise<SyncResult> {
  const raw = process.env.SUBSTACK_COOKIE || process.env.SUBSTACK_SID;
  if (!raw) {
    return { skipped: 'SUBSTACK_COOKIE is not set', seen: 0, paid: 0, added: 0, reactivated: 0, planChanged: 0, unsubscribed: 0 };
  }
  const cookie = cookieHeader(raw);

  const seen = new Map<string, boolean>();
  let offset = 0;
  let total: number | null = null;
  for (let pageNo = 0; pageNo < 1000; pageNo++) {
    const page = await fetchSubscriberPage(cookie, offset);
    if (total === null) total = page.count;
    for (const e of page.entries) seen.set(e.email, seen.get(e.email) === true || e.paid === true);
    offset += page.size;
    if (page.size < PAGE_SIZE || (total !== null && offset >= total)) break;
    await new Promise((r) => setTimeout(r, 1200)); // stay well under Substack's rate limit
  }

  const { added, reactivated, planChanged } = await upsertSubscribers(
    strapi,
    [...seen].map(([email, paid]) => ({ email, paid })),
    'sync'
  );

  // Mark people no longer on the list as unsubscribed, guarded against
  // partial or broken responses.
  const active: any[] = await strapi.db.query(UID).findMany({ where: { status: 'active' }, select: ['id', 'email'] });
  const previousActive = active.length - added - reactivated;
  const missing = active.filter((r) => !seen.has(r.email));

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

  const paid = [...seen.values()].filter(Boolean).length;
  return { seen: seen.size, paid, added, reactivated, planChanged, unsubscribed, unsubscribeSkipped };
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

/**
 * Reads the plan from a Substack export row. Uses the "plan" column when
 * present (anything but "free" is paid), else "active_subscription"
 * (true = paid). Returns undefined when the file has neither column.
 */
function csvPaid(row: string[], planCol: number, activeCol: number): boolean | undefined {
  if (planCol !== -1) {
    const plan = (row[planCol] ?? '').trim().toLowerCase();
    return !!plan && plan !== 'free';
  }
  if (activeCol !== -1) return /^(true|yes|1)$/i.test((row[activeCol] ?? '').trim());
  return undefined;
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
    const planCol = header.findIndex((h) => h === 'plan' || h === 'subscription_interval');
    const activeCol = header.findIndex((h) => h === 'active_subscription');
    let dataRows = rows.slice(1);
    if (col === -1) {
      // No header we recognise: use the first column that holds an email.
      col = rows[0].findIndex((v) => !!normalizeEmail(v));
      dataRows = rows;
    }
    if (col === -1) throw new Error('no "email" column found');

    const withEmail = dataRows.filter((r) => r[col] && r[col].trim());
    const entries: SubscriberEntry[] = [];
    for (const r of withEmail) {
      const email = normalizeEmail(r[col]);
      if (email) entries.push({ email, paid: csvPaid(r, planCol, activeCol) });
    }
    const invalid = withEmail.length - entries.length;
    const paidCount = entries.filter((e) => e.paid).length;
    const { added, reactivated, unchanged } = await upsertSubscribers(strapi, entries, 'csv');

    const planNote =
      planCol === -1 && activeCol === -1
        ? ' The file has no "plan" column, so nobody was marked as paid; export the list from Substack with plans included.'
        : ` ${paidCount} on a paid plan.`;
    const summary =
      `Imported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC: ` +
      `${added} new, ${reactivated} reactivated, ${unchanged} already present` +
      (invalid ? `, ${invalid} rows skipped (not a valid email)` : '') +
      '.' +
      planNote;
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
