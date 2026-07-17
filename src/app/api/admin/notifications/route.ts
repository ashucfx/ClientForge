// src/app/api/admin/notifications/route.ts
// GET: fetch paginated admin notifications
// PATCH: mark all as read
// Zero schema changes — reads existing Notification model

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || 'catalyst';

  const notifications = await db.notification.findMany({
    where:   { adminId: session.adminId, brandId: brand },
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

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || 'catalyst';

  await db.notification.updateMany({
    where: { adminId: session.adminId, brandId: brand, isRead: false },
    data:  { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
