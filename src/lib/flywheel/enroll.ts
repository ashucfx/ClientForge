// src/lib/flywheel/enroll.ts
// Shared server-side enrolment for campaigns. Used by scheduled-launch (cron)
// and available for any server flow that needs to resolve an audience and enrol
// leads. The (campaignId, contactId) unique constraint + skipDuplicates means
// re-enrolment never re-sends to someone already in the campaign.

import { prisma as db } from '@/lib/db';

interface CampaignMetadata {
  audienceFilter?: string;
  contactIds?: string[];
  scheduledAt?: string;
}

/** Resolve a campaign's stored audience (metadata) into contact ids. */
export async function resolveAudienceContactIds(metadata: unknown): Promise<string[]> {
  const meta = (metadata ?? {}) as CampaignMetadata;
  const filter = meta.audienceFilter ?? 'ALL';

  if (filter === 'PICK') {
    return Array.isArray(meta.contactIds) ? meta.contactIds : [];
  }

  const where: Record<string, unknown> = { status: 'ACTIVE' };
  if (filter !== 'ALL') {
    where.flywheelProfile = { lifecycleStage: filter };
  }
  const contacts = await db.contact.findMany({ where, select: { id: true }, take: 5000 });
  return contacts.map(c => c.id);
}

export interface EnrolResult { enrolled: number; alreadyEnrolled: number; dncSkipped: number }

/** Enrol contacts into a campaign, activating it. DNC + already-enrolled are skipped. */
export async function enrollLeads(campaignId: string, contactIds: string[]): Promise<EnrolResult> {
  if (contactIds.length === 0) return { enrolled: 0, alreadyEnrolled: 0, dncSkipped: 0 };

  const dnc = await db.flywheelProfile.findMany({
    where: { contactId: { in: contactIds }, optInStatus: false },
    select: { contactId: true },
  });
  const dncSet = new Set(dnc.map(p => p.contactId));
  const eligible = contactIds.filter(id => !dncSet.has(id));
  const dncSkipped = contactIds.length - eligible.length;
  if (eligible.length === 0) return { enrolled: 0, alreadyEnrolled: 0, dncSkipped };

  const campaign = await db.flywheelCampaign.findUnique({
    where: { id: campaignId },
    include: { steps: { orderBy: { orderIndex: 'asc' }, take: 1 } },
  });
  const firstStep = campaign?.steps[0];
  if (!firstStep) return { enrolled: 0, alreadyEnrolled: 0, dncSkipped };

  const enrolled = await db.$transaction(async (tx) => {
    await tx.flywheelCampaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });
    const runAt = new Date();
    runAt.setHours(runAt.getHours() + firstStep.delayHours);
    const created = await tx.flywheelCampaignLead.createMany({
      data: eligible.map(contactId => ({
        campaignId, contactId, currentStepId: firstStep.id, status: 'ACTIVE', nextExecutionAt: runAt,
      })),
      skipDuplicates: true,
    });
    return created.count as number;
  });

  return { enrolled, alreadyEnrolled: eligible.length - enrolled, dncSkipped };
}
