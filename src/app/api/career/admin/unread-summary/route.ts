// src/app/api/career/admin/unread-summary/route.ts
// Returns aggregated unread message/revision/notification counts for the admin sidebar badge.
// Zero schema changes — uses existing readByAdmin boolean and Notification model.

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current admin ID for unread notification count
  const session = await getAdminSession();

  // Robustly synchronize AdminUser.lastLoginAt (throttle updates to every 15 minutes)
  if (session) {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    void db.adminUser.updateMany({
      where: {
        id: session.adminId,
        OR: [
          { lastLoginAt: null },
          { lastLoginAt: { lt: fifteenMinsAgo } },
        ],
      },
      data: { lastLoginAt: new Date() },
    }).catch(err => console.error('[unread-summary] failed to sync admin lastLoginAt:', err));
  }

  // 1. All client messages that admin hasn't read yet (authorType = 'client', readByAdmin = false)
  const unreadMessages = await db.careerMessage.findMany({
    where: { authorType: 'client', readByAdmin: false },
    select: {
      id: true,
      clientId: true,
      content: true,
      createdAt: true,
      client: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Also check unread comments (client → admin)
  const unreadComments = await db.careerComment.findMany({
    where: { authorType: 'client', readByAdmin: false, isInternalOnly: false },
    select: {
      id: true,
      clientId: true,
      content: true,
      createdAt: true,
      client: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Group by clientId, pick the most recent per client
  const clientMap = new Map<string, {
    id: string; name: string; email: string;
    unreadMessages: number; unreadComments: number;
    lastActivityAt: Date; lastPreview: string;
  }>();

  for (const msg of unreadMessages) {
    const existing = clientMap.get(msg.clientId);
    if (!existing) {
      clientMap.set(msg.clientId, {
        id: msg.client.id,
        name: msg.client.name,
        email: msg.client.email,
        unreadMessages: 1,
        unreadComments: 0,
        lastActivityAt: msg.createdAt,
        lastPreview: msg.content.slice(0, 80),
      });
    } else {
      existing.unreadMessages++;
      if (msg.createdAt > existing.lastActivityAt) {
        existing.lastActivityAt = msg.createdAt;
        existing.lastPreview = msg.content.slice(0, 80);
      }
    }
  }

  for (const comment of unreadComments) {
    const existing = clientMap.get(comment.clientId);
    if (!existing) {
      clientMap.set(comment.clientId, {
        id: comment.client.id,
        name: comment.client.name,
        email: comment.client.email,
        unreadMessages: 0,
        unreadComments: 1,
        lastActivityAt: comment.createdAt,
        lastPreview: comment.content.slice(0, 80),
      });
    } else {
      existing.unreadComments++;
      if (comment.createdAt > existing.lastActivityAt) {
        existing.lastActivityAt = comment.createdAt;
        existing.lastPreview = comment.content.slice(0, 80);
      }
    }
  }

  // Sort: most recent unread first
  const clientsWithUnread = Array.from(clientMap.values()).sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
  );

  // 3. Pending revision requests
  const pendingRevisions = await db.careerRevision.count({
    where: { status: 'PENDING', requestedBy: 'client' },
  });

  // 4. Unread admin notifications (count AND recent items)
  const unreadNotificationsCount = session
    ? await db.notification.count({
        where: { adminId: session.adminId, isRead: false },
      })
    : 0;

  const recentNotifications = session
    ? await db.notification.findMany({
        where: { adminId: session.adminId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, message: true, type: true, createdAt: true, link: true },
      })
    : [];

  const totalUnreadMessages = unreadMessages.length + unreadComments.length;

  return NextResponse.json({
    totalUnread: totalUnreadMessages + pendingRevisions,
    totalUnreadMessages,
    pendingRevisions,
    unreadNotifications: unreadNotificationsCount,
    recentNotifications,
    clientsWithUnread: clientsWithUnread.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      unreadCount: c.unreadMessages + c.unreadComments,
      lastActivityAt: c.lastActivityAt.toISOString(),
      lastPreview: c.lastPreview,
    })),
  });
}
