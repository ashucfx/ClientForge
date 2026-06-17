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

    // Ensure Campaign exists and get first step
    const campaign = await db.flywheelCampaign.findUnique({
      where: { id: campaignId },
      include: { steps: { orderBy: { orderIndex: 'asc' } } }
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    const firstStep = campaign.steps[0];
    if (!firstStep) {
      return NextResponse.json({ success: false, error: 'Campaign has no steps configured' }, { status: 400 });
    }

    // Attach leads and set campaign to ACTIVE
    await db.$transaction(async (tx: any) => {
      // 1. Activate campaign
      await tx.flywheelCampaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE' }
      });

      // 2. Filter out Do Not Contact contacts before inserting
      const dncProfiles = await tx.flywheelProfile.findMany({
        where: { contactId: { in: contactIds }, optInStatus: false },
        select: { contactId: true },
      });
      const dncSet = new Set(dncProfiles.map((p: { contactId: string }) => p.contactId));
      const eligibleIds = contactIds.filter((id: string) => !dncSet.has(id));

      const now = new Date();
      now.setHours(now.getHours() + firstStep.delayHours);

      // Using createMany and ignoring duplicates
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

    return NextResponse.json({ success: true, message: 'Campaign dispatched successfully' });

  } catch (error) {
    console.error('[FlywheelCampaignDispatch] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
