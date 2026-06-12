export default {
  async beforeUpdate(event: {
    params: { where?: { documentId?: string }; data?: Record<string, unknown> };
    state: Record<string, unknown>;
  }) {
    const { params, state } = event;

    // Only fetch previous state when the update is setting reviewStatus to approved
    if (params.data?.reviewStatus !== 'approved') return;

    const documentId = params.where?.documentId;
    if (!documentId) return;

    const current = await strapi
      .documents('api::deal-submission.deal-submission')
      .findOne({ documentId });

    state.previousStatus = (current as any)?.reviewStatus ?? null;
  },

  async afterUpdate(event: {
    result: Record<string, unknown>;
    state: Record<string, unknown>;
  }) {
    const { result, state } = event;

    // Only act on a transition to 'approved' — skip if it was already approved
    if (result.reviewStatus !== 'approved' || state.previousStatus === 'approved') {
      return;
    }

    try {
      const deal = await strapi.documents('api::deal.deal').create({
        data: {
          businessName: result.businessName as string,
          industry: result.industry as string,
          description: (result.description as string | null) ?? null,
          fundingRequired: (result.fundingNeeded as number | null) ?? null,
          contactEmail: (result.contactEmail as string | null) ?? null,
          reviewStatus: 'approved',
        } as any,
      });

      strapi.log.info(
        `[deal-submission] Deal ${deal.documentId} created from approved submission ${result.documentId}`
      );
    } catch (err: unknown) {
      strapi.log.error(
        '[deal-submission] Failed to create Deal from approved submission:',
        err instanceof Error ? err.message : String(err)
      );
    }
  },
};
