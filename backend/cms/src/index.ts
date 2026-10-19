import type { Core } from '@strapi/strapi';

const API_UIDS = [
  'api::team-member.team-member',
  'api::blog-link.blog-link',
  'api::page-content.page-content',
  'api::deal.deal',
  'api::deal-submission.deal-submission',
  'api::investor-interest.investor-interest',
  'api::featured-deal.featured-deal',
] as const;

const PUBLIC_ACTIONS: string[] = [
  'api::team-member.team-member.find',
  'api::team-member.team-member.findOne',
  'api::blog-link.blog-link.find',
  'api::blog-link.blog-link.findOne',
  'api::page-content.page-content.find',
  'api::page-content.page-content.findOne',
  'api::featured-deal.featured-deal.find',
  'api::featured-deal.featured-deal.findOne',
  // Deal: find/findOne are public but the controller enforces status=approved for unauthed requests
  'api::deal.deal.find',
  'api::deal.deal.findOne',
  // Submission forms: public can create, not read
  'api::deal-submission.deal-submission.create',
  'api::investor-interest.investor-interest.create',
];

const AUTHENTICATED_ACTIONS: string[] = API_UIDS.flatMap((uid) =>
  ['find', 'findOne', 'create', 'update', 'delete'].map((action) => `${uid}.${action}`)
);

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedRolePermissions(strapi, 'public', PUBLIC_ACTIONS);
    await seedRolePermissions(strapi, 'authenticated', AUTHENTICATED_ACTIONS);
    await dedupeBlogLinks(strapi);
  },
};

// One-time cleanup: the Substack feed switched domains, so every post was
// imported twice (once per domain). This collapses each article (keyed by its
// post slug) to a single entry on the canonical domain and fixes mojibake in
// titles/descriptions. Idempotent — safe to leave on, but gated behind an env
// flag so it only runs when intended. Set RUN_BLOGLINK_DEDUP=true to run.
const CANONICAL_HOST = 'tochukwuezeukwu.substack.com';

function blogSlug(url: string): string {
  const base = (url || '').split('?')[0].replace(/\/+$/, '');
  return base.split('/').pop() || base;
}

function fixMojibake<T>(value: T): T {
  return typeof value === 'string'
    ? (value.replace(/�/g, '’') as unknown as T)
    : value;
}

async function dedupeBlogLinks(strapi: Core.Strapi): Promise<void> {
  if (process.env.RUN_BLOGLINK_DEDUP !== 'true') return;
  strapi.log.info('[blog-dedup] Starting one-time blog-link dedup…');

  const all = await strapi.documents('api::blog-link.blog-link').findMany({
    fields: ['title', 'url', 'description'],
    limit: -1,
  });

  const groups = new Map<string, any[]>();
  for (const entry of all) {
    const slug = blogSlug(entry.url);
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug)!.push(entry);
  }

  let kept = 0;
  let deleted = 0;
  let normalized = 0;

  for (const [slug, entries] of groups) {
    // Prefer the entry already on the canonical domain as the one to keep.
    entries.sort((a, b) => {
      const aCanon = (a.url || '').includes(CANONICAL_HOST) ? 0 : 1;
      const bCanon = (b.url || '').includes(CANONICAL_HOST) ? 0 : 1;
      return aCanon - bCanon;
    });
    const keep = entries[0];
    const rest = entries.slice(1);

    const data: Record<string, unknown> = {};
    const canonUrl = 'https://' + CANONICAL_HOST + '/p/' + slug;
    if (keep.url !== canonUrl) data.url = canonUrl;
    const fixedTitle = fixMojibake(keep.title);
    if (fixedTitle !== keep.title) data.title = fixedTitle;
    const fixedDesc = fixMojibake(keep.description);
    if (fixedDesc !== keep.description) data.description = fixedDesc;
    if (Object.keys(data).length) {
      await strapi
        .documents('api::blog-link.blog-link')
        .update({ documentId: keep.documentId, data });
      normalized++;
    }
    kept++;

    for (const dup of rest) {
      await strapi
        .documents('api::blog-link.blog-link')
        .delete({ documentId: dup.documentId });
      deleted++;
    }
  }

  strapi.log.info(
    `[blog-dedup] Done. unique=${kept} deleted=${deleted} normalized=${normalized}`
  );
}

async function seedRolePermissions(
  strapi: Core.Strapi,
  roleType: string,
  actions: string[]
): Promise<void> {
  const role = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });

  if (!role) {
    strapi.log.warn(`[bootstrap] Role '${roleType}' not found — skipping.`);
    return;
  }

  const existing = await strapi
    .query('plugin::users-permissions.permission')
    .findMany({ where: { role: { id: role.id }, action: { $in: actions } } });

  const existingSet = new Set(existing.map((p: { action: string }) => p.action));
  const toCreate = actions.filter((a) => !existingSet.has(a));

  if (toCreate.length === 0) {
    strapi.log.info(`[bootstrap] '${roleType}' permissions already up to date.`);
    return;
  }

  await Promise.all(
    toCreate.map((action) =>
      strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: role.id },
      })
    )
  );

  strapi.log.info(`[bootstrap] Seeded ${toCreate.length} '${roleType}' permission(s).`);
}
