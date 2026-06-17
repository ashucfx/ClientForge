import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';

// Toggle Do Not Contact flag on a contact's FlywheelProfile
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { optInStatus } = body; // explicit boolean, or omit to toggle

  const profile = await db.flywheelProfile.findUnique({
    where: { contactId: params.id },
    select: { id: true, optInStatus: true },
  });
  if (!profile) return NextResponse.json({ error: 'Flywheel profile not found' }, { status: 404 });

  const newStatus = typeof optInStatus === 'boolean' ? optInStatus : !profile.optInStatus;

  const updated = await db.flywheelProfile.update({
    where: { id: profile.id },
    data: {
      optInStatus: newStatus,
      ...(newStatus === false ? { optInSource: 'ADMIN_DNC' } : {}),
    },
    select: { optInStatus: true },
  });

  await db.auditLog.create({
    data: {
      tenantId: 'system',
      adminId:  session.adminId,
      action:   newStatus ? 'CONTACT_OPT_IN' : 'CONTACT_OPT_OUT',
      entity:   'FlywheelProfile',
      entityId: profile.id,
      changes:  { optInStatus: newStatus },
    },
  });

  return NextResponse.json({ ok: true, optInStatus: updated.optInStatus });
}
