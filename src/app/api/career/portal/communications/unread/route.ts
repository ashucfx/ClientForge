import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const readState = await db.conversationReadState.findUnique({
    where: { careerClientId: payload.clientId }
  });

  const unreadCount = readState?.unreadByClient ?? 0;

  // Also include general notifications for the bell
  const unreadNotificationsCount = await db.clientNotification.count({
    where: { careerClientId: payload.clientId, isRead: false },
  });

  return NextResponse.json({
    unreadMessages: unreadCount,
    unreadNotifications: unreadNotificationsCount
  });
}
