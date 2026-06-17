import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

async function authorize() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) return null;
  return session;
}

// PATCH — update status (pause / resume)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await db.flywheelCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
}
