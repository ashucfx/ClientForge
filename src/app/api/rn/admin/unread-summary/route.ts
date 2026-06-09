// src/app/api/rn/admin/unread-summary/route.ts
// Returns aggregated unread counts for RN clients (messages + comments).
// Zero schema changes — uses existing readByAdmin boolean.

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

async function requireRnAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus')) return null;
  return session;
}

export async function GET() {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  // Unread client messages
  const unreadMessages = await db.rnMessage.findMany({
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

  // Unread client comments
  const unreadComments = await db.rnComment.findMany({
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

  // Group by client
  const clientMap = new Map<string, {
    id: string; name: string; email: string;
    unreadCount: number; lastActivityAt: Date; lastPreview: string;
  }>();

  const addToMap = (clientId: string, client: { id: string; name: string; email: string }, content: string, createdAt: Date) => {
    const existing = clientMap.get(clientId);
    if (!existing) {
      clientMap.set(clientId, {
        id: client.id, name: client.name, email: client.email,
        unreadCount: 1, lastActivityAt: createdAt,
        lastPreview: content.slice(0, 80),
      });
    } else {
      existing.unreadCount++;
      if (createdAt > existing.lastActivityAt) {
        existing.lastActivityAt = createdAt;
        existing.lastPreview = content.slice(0, 80);
      }
    }
  };

  for (const msg of unreadMessages) addToMap(msg.clientId, msg.client, msg.content, msg.createdAt);
  for (const comment of unreadComments) addToMap(comment.clientId, comment.client, comment.content, comment.createdAt);

  // Pending RN revision requests
  const pendingRevisions = await db.rnRevision.count({
    where: { status: 'PENDING', requestedBy: 'client' },
  });

  const clientsWithUnread = Array.from(clientMap.values()).sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
  );

  const totalUnreadMessages = unreadMessages.length + unreadComments.length;

  return NextResponse.json({
    totalUnread: totalUnreadMessages + pendingRevisions,
    totalUnreadMessages,
    pendingRevisions,
    clientsWithUnread: clientsWithUnread.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      unreadCount: c.unreadCount,
      lastActivityAt: c.lastActivityAt.toISOString(),
      lastPreview: c.lastPreview,
    })),
  });
}
