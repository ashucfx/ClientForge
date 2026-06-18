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
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one contact ID required' }, { status: 400 });
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

    // Filter DNC contacts before the transaction so the count is available after
    const dncProfiles = await db.flywheelProfile.findMany({
      where: { contactId: { in: contactIds }, optInStatus: false },
      select: { contactId: true },
    });
    const dncSet = new Set(dncProfiles.map((p: { contactId: string }) => p.contactId));
    const eligibleIds: string[] = contactIds.filter((id: string) => !dncSet.has(id));
    const skipped = contactIds.length - eligibleIds.length;

    // Attach leads and set campaign to ACTIVE
    await db.$transaction(async (tx: any) => {
      // 1. Activate campaign
      await tx.flywheelCampaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE' }
      });

      const now = new Date();
      now.setHours(now.getHours() + firstStep.delayHours);

      await tx.flywheelCampaignLead.createMany({
        data: eligibleIds.map((contactId: string) => ({
          campaignId,
          contactId,
          currentStepId: firstStep.id,
          status: 'ACTIVE',
          nextExecutionAt: now
        })),
        skipDuplicates: true
      });
    });

    return NextResponse.json({
      success: true,
      dispatched: eligibleIds.length,
      skipped,
      message: skipped > 0
        ? `Dispatched ${eligibleIds.length} contacts. ${skipped} skipped (Do Not Contact).`
        : `Dispatched ${eligibleIds.length} contacts.`,
    });

  } catch (error) {
    console.error('[FlywheelCampaignDispatch] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
