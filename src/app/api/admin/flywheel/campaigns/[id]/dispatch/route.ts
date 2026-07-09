import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const body = await req.json();
    const { contactIds, scheduledAt } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one contact ID required' }, { status: 400 });
    }

    // Optional scheduling: a future timestamp defers enrolment to the cron
    let scheduleDate: Date | null = null;
    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid scheduledAt date' }, { status: 400 });
      }
      if (scheduleDate.getTime() <= Date.now()) scheduleDate = null; // past date = send now
    }

    // Ensure Campaign exists, belongs to this admin's tenant, and get first step
    const campaign = await db.flywheelCampaign.findUnique({
      where: { id: campaignId },
      include: { steps: { orderBy: { orderIndex: 'asc' } } }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Tenant isolation: EDITOR-role admins can only dispatch their own brand's campaigns
    if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const firstStep = campaign.steps[0];
    if (!firstStep) {
      return NextResponse.json({ success: false, error: 'Campaign has no steps configured' }, { status: 400 });
    }

    // ── Scheduled launch: store the plan in metadata; the cron enrols when due ──
    if (scheduleDate) {
      const existingMeta = (campaign.metadata ?? {}) as Record<string, unknown>;
      await db.flywheelCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'SCHEDULED',
          metadata: {
            ...existingMeta,
            scheduledAt: scheduleDate.toISOString(),
            scheduledContactIds: contactIds,
          } as object,
        },
      });
      return NextResponse.json({
        success: true,
        scheduled: true,
        scheduledAt: scheduleDate.toISOString(),
        message: `Scheduled for ${scheduleDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} — ${contactIds.length} lead${contactIds.length === 1 ? '' : 's'} will be enrolled automatically.`,
      });
    }

    // Filter DNC contacts before the transaction so the count is available after
    const dncProfiles = await db.flywheelProfile.findMany({
      where: { contactId: { in: contactIds }, optInStatus: false },
      select: { contactId: true },
    });
    const dncSet = new Set(dncProfiles.map((p: { contactId: string }) => p.contactId));
    const eligibleIds: string[] = contactIds.filter((id: string) => !dncSet.has(id));
    const skipped = contactIds.length - eligibleIds.length;

    // Attach leads and set campaign to ACTIVE. The (campaignId, contactId)
    // unique constraint + skipDuplicates means re-dispatching only enrols NEW
    // leads — contacts already in this campaign are skipped (never re-sent).
    const enrolled = await db.$transaction(async (tx: any) => {
      await tx.flywheelCampaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE' }
      });

      const now = new Date();
      now.setHours(now.getHours() + firstStep.delayHours);

      const created = await tx.flywheelCampaignLead.createMany({
        data: eligibleIds.map((contactId: string) => ({
          campaignId,
          contactId,
          currentStepId: firstStep.id,
          status: 'ACTIVE',
          nextExecutionAt: now
        })),
        skipDuplicates: true
      });
      return created.count as number;
    });

    const alreadyEnrolled = eligibleIds.length - enrolled;

    return NextResponse.json({
      success: true,
      enrolled,
      alreadyEnrolled,
      dncSkipped: skipped,
      // kept for backward compatibility
      dispatched: enrolled,
      skipped,
      message:
        `Enrolled ${enrolled} new lead${enrolled === 1 ? '' : 's'}.` +
        (alreadyEnrolled > 0 ? ` ${alreadyEnrolled} already in this campaign (skipped).` : '') +
        (skipped > 0 ? ` ${skipped} skipped (Do Not Contact).` : ''),
    });

  } catch (error) {
    console.error('[FlywheelCampaignDispatch] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
