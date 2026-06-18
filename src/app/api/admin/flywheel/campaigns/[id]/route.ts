import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

async function authorize(campaignId: string) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) return null;

  // Tenant isolation: verify the campaign belongs to this admin's active tenant
  const campaign = await db.flywheelCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) return null;

  return { session, campaign };
}

// PATCH — update status (pause / resume)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  const { status } = await req.json();
  const allowed = ['ACTIVE', 'PAUSED', 'DRAFT'];
  if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  try {
    const campaign = await db.flywheelCampaign.update({
      where: { id: params.id },
      data: { status },
    });
    return NextResponse.json({ success: true, data: campaign });
  } catch {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
}

// DELETE — remove campaign and all associated leads/events (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  try {
    await db.flywheelCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
}
