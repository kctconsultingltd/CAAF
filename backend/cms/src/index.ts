import type { Core } from '@strapi/strapi';

const API_UIDS = [
  'api::team-member.team-member',
  'api::blog-link.blog-link',
  'api::page-content.page-content',
  'api::deal.deal',
  'api::deal-submission.deal-submission',
  'api::investor-interest.investor-interest',
] as const;

const PUBLIC_ACTIONS: string[] = [
  'api::team-member.team-member.find',
  'api::team-member.team-member.findOne',
  'api::blog-link.blog-link.find',
  'api::blog-link.blog-link.findOne',
  'api::page-content.page-content.find',
  'api::page-content.page-content.findOne',
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
  },
};

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
