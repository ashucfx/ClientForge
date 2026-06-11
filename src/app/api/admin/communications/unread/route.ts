import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Update lastLoginAt robustly
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
  }).catch(err => console.error('[unread-global] failed to sync admin lastLoginAt:', err));

  // Get conversation states where admin has unread messages
  const unreadStates = await db.conversationReadState.findMany({
    where: {
      unreadByAdmin: { gt: 0 }
    },
    include: {
      careerClient: {
        select: { id: true, name: true, email: true, status: true, slaDeadline: true }
      },
      rnClient: {
        select: { id: true, name: true, email: true, currentStage: true, slaDeadline: true }
      }
    },
    orderBy: [
      { lastMessageAt: 'desc' }, // newest activity
    ],
    take: 50
  });

  // Calculate SLA Risks (e.g. deadline within next 24h or already missed)
  const sortedByPriority = unreadStates.sort((a, b) => {
    // We sort by SLA risk primarily if they are within 24h of deadline
    const now = Date.now();
    const getDeadline = (s: typeof a) => s.careerClient?.slaDeadline || s.rnClient?.slaDeadline;
    
    const deadlineA = getDeadline(a);
    const deadlineB = getDeadline(b);

    const isRiskA = deadlineA && (deadlineA.getTime() - now) < 24 * 60 * 60 * 1000;
    const isRiskB = deadlineB && (deadlineB.getTime() - now) < 24 * 60 * 60 * 1000;

    if (isRiskA && !isRiskB) return -1;
    if (!isRiskA && isRiskB) return 1;

    // Otherwise sort by unread count (desc) and newest activity
    if (b.unreadByAdmin !== a.unreadByAdmin) {
      return b.unreadByAdmin - a.unreadByAdmin;
    }
    
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });

  const totalUnreadClients = await db.conversationReadState.count({
    where: { unreadByAdmin: { gt: 0 } }
  });

  // Also include general notifications for the bell
  const unreadNotificationsCount = await db.notification.count({
    where: { adminId: session.adminId, isRead: false },
  });

  return NextResponse.json({
    totalUnreadClients,
    totalUnreadNotifications: unreadNotificationsCount,
    conversations: sortedByPriority.map(state => ({
      id: state.id,
      clientId: state.careerClientId || state.rnClientId,
      clientType: state.careerClientId ? 'CAREER' : 'RN',
      name: state.careerClient?.name || state.rnClient?.name,
      email: state.careerClient?.email || state.rnClient?.email,
      unreadCount: state.unreadByAdmin,
      lastActivityAt: state.lastMessageAt,
      slaDeadline: state.careerClient?.slaDeadline || state.rnClient?.slaDeadline
    }))
  });
}
