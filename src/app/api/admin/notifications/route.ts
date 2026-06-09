// src/app/api/admin/notifications/route.ts
// GET: fetch paginated admin notifications
// PATCH: mark all as read
// Zero schema changes — reads existing Notification model

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await db.notification.findMany({
    where:   { adminId: session.adminId },
    orderBy: { createdAt: 'desc' },
    take:    100,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ notifications });
}

export async function PATCH() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.notification.updateMany({
    where: { adminId: session.adminId, isRead: false },
    data:  { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
