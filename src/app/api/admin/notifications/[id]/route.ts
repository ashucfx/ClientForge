import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (notif.adminId !== session.adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.notification.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
