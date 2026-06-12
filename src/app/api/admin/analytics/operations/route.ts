import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 1. Deliverables Awaiting Action
  const pendingCareerDeliveries = await db.careerDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const pendingRnDeliveries = await db.rnDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const totalPendingDeliveries = pendingCareerDeliveries + pendingRnDeliveries;

  // 2. Near SLA Breach
  const careerNearSla = await db.careerClient.count({
    where: { 
      status: { notIn: ['COMPLETED', 'NOT_STARTED'] },
      slaDeadline: { lte: threeDaysFromNow, gt: now }
    }
  });
  const rnNearSla = await db.rnClient.count({
    where: { 
      currentStage: { notIn: ['COMPLETED', 'LAUNCHED', 'NOT_STARTED'] },
      slaDeadline: { lte: threeDaysFromNow, gt: now }
    }
  });
  const nearSlaBreach = careerNearSla + rnNearSla;

  // 3. Unread Messages (> 24 hours & > 48 hours)
  const unreadMessages24h = await db.conversationReadState.count({
    where: { unreadByAdmin: { gt: 0 }, lastMessageAt: { lt: oneDayAgo, gte: twoDaysAgo } }
  });
  const unreadMessages48h = await db.conversationReadState.count({
    where: { unreadByAdmin: { gt: 0 }, lastMessageAt: { lt: twoDaysAgo } }
  });
  const totalUnreadMessages = await db.conversationReadState.count({
    where: { unreadByAdmin: { gt: 0 } }
  });

  // 4. Negative Feedback
  const negativeFeedback = await db.feedback.count({
    where: { rating: { lte: 2 } }
  });

  // 5. At Risk Clients
  const atRiskClients = await db.clientHealthScore.count({
    where: { status: 'AT_RISK' }
  });
  const attentionNeededClients = await db.clientHealthScore.count({
    where: { status: 'ATTENTION_NEEDED' }
  });
  const healthyClients = await db.clientHealthScore.count({
    where: { status: { in: ['EXCELLENT', 'HEALTHY'] } }
  });
  const totalHealthScores = await db.clientHealthScore.count();
  const averageHealthScoreAggr = await db.clientHealthScore.aggregate({
    _avg: { score: true }
  });

  return NextResponse.json({
    alerts: {
      pendingDeliveries: totalPendingDeliveries,
      nearSlaBreach,
      unreadMessages24h,
      unreadMessages48h,
      negativeFeedback,
      atRiskClients
    },
    communications: {
      totalUnreadMessages,
      escalatedUnread: unreadMessages24h + unreadMessages48h,
      clientsWaiting24h: unreadMessages24h,
      clientsWaiting48h: unreadMessages48h,
      // placeholder for SLA compliance as we don't track message SLA yet explicitly in db
      communicationSlaCompliance: unreadMessages48h === 0 ? 100 : Math.round(((totalUnreadMessages - unreadMessages48h) / (totalUnreadMessages || 1)) * 100)
    },
    health: {
      healthy: healthyClients,
      attentionNeeded: attentionNeededClients,
      atRisk: atRiskClients,
      averageScore: averageHealthScoreAggr._avg.score ? Math.round(averageHealthScoreAggr._avg.score) : null,
      totalTracked: totalHealthScores
    }
  });
}
