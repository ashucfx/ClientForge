import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

async function authorize(campaignId: string) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) return null;
  const campaign = await db.flywheelCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) return null;
  return { session, campaign };
}

// GET — enrolled leads with contact + status + which step they're on
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  const leads = await db.flywheelCampaignLead.findMany({
    where: { campaignId: params.id },
    include: {
      contact: { select: { id: true, name: true, email: true } },
      currentStep: { select: { orderIndex: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  return NextResponse.json({
    success: true,
    leads: leads.map(l => ({
      leadId: l.id,
      contactId: l.contactId,
      name: l.contact?.name ?? '(no name)',
      email: l.contact?.email ?? '',
      status: l.status,
      stepIndex: l.currentStep?.orderIndex ?? 0,
      nextExecutionAt: l.nextExecutionAt,
    })),
  });
}

// PATCH { leadId, action: 'pause' | 'resume' | 'remove' } — manage a single lead
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  const { leadId, action } = await req.json().catch(() => ({}));
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const lead = await db.flywheelCampaignLead.findFirst({ where: { id: leadId, campaignId: params.id } });
  if (!lead) return NextResponse.json({ error: 'Lead not in this campaign' }, { status: 404 });

  try {
    if (action === 'remove') {
      await db.flywheelCampaignLead.delete({ where: { id: leadId } });
    } else if (action === 'pause') {
      await db.flywheelCampaignLead.update({ where: { id: leadId }, data: { status: 'PAUSED' } });
    } else if (action === 'resume') {
      await db.flywheelCampaignLead.update({ where: { id: leadId }, data: { status: 'ACTIVE' } });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Campaign leads PATCH] error:', e);
    return NextResponse.json({ error: 'Could not update lead' }, { status: 500 });
  }
}
