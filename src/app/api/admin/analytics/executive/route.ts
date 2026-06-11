import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  
  // Revenue (Paid invoices)
  const paidInvoices = await db.invoice.aggregate({
    _sum: { totalPayable: true },
    where: { status: 'PAID' }
  });
  const totalRevenue = paidInvoices._sum.totalPayable || 0;

  // Active Clients (Career Booster & RN)
  const activeCareerClients = await db.careerClient.count({
    where: { status: { notIn: ['COMPLETED', 'NOT_STARTED'] }, lifecycleStatus: 'ACTIVE' }
  });
  const activeRnClients = await db.rnClient.count({
    where: { currentStage: { notIn: ['COMPLETED', 'LAUNCHED', 'NOT_STARTED'] }, lifecycleStatus: 'ACTIVE' }
  });
  const totalActiveClients = activeCareerClients + activeRnClients;

  // NPS & Satisfaction
  const feedbacks = await db.feedback.findMany({ select: { npsScore: true, rating: true } });
  
  let nps = 0;
  let avgRating = 0;
  if (feedbacks.length > 0) {
    let promoters = 0;
    let detractors = 0;
    let totalRating = 0;

    feedbacks.forEach(fb => {
      // Assuming npsScore is 0-10
      if (fb.npsScore >= 9) promoters++;
      else if (fb.npsScore <= 6) detractors++;
      totalRating += fb.rating;
    });

    nps = Math.round(((promoters / feedbacks.length) - (detractors / feedbacks.length)) * 100);
    avgRating = Number((totalRating / feedbacks.length).toFixed(1));
  }

  // Pending Deliveries & Revisions
  const pendingCareerRevisions = await db.careerRevision.count({ where: { status: 'PENDING' }});
  const pendingRnRevisions = await db.rnRevision.count({ where: { status: 'PENDING' }});
  const pendingRevisions = pendingCareerRevisions + pendingRnRevisions;

  // Deliverables pending approval or un-sent
  const pendingCareerDeliveries = await db.careerDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const pendingRnDeliveries = await db.rnDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const pendingDeliveries = pendingCareerDeliveries + pendingRnDeliveries;

  // Unread Messages > 24h
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const unreadMessagesEscalated = await db.conversationReadState.count({
    where: {
      unreadByAdmin: { gt: 0 },
      lastMessageAt: { lt: oneDayAgo }
    }
  });

  // At-Risk Clients
  const atRiskClients = await db.clientHealthScore.count({
    where: { status: 'AT_RISK' }
  });

  // SLA Calculation (Simplified: just Career right now for example, or both)
  // SLA Met %
  const completedCareerClients = await db.careerClient.findMany({
    where: { status: 'COMPLETED', slaDeadline: { not: null }, completedAt: { not: null } },
    select: { completedAt: true, slaDeadline: true }
  });
  
  const completedRnClients = await db.rnClient.findMany({
    where: { currentStage: 'LAUNCHED', slaDeadline: { not: null }, completedAt: { not: null } },
    select: { completedAt: true, slaDeadline: true }
  });

  let slaMet = 0;
  let totalSlaEligible = completedCareerClients.length + completedRnClients.length;

  for (const c of completedCareerClients) {
    if (c.completedAt! <= c.slaDeadline!) slaMet++;
  }
  for (const c of completedRnClients) {
    if (c.completedAt! <= c.slaDeadline!) slaMet++;
  }

  const slaMetPercentage = totalSlaEligible > 0 ? Math.round((slaMet / totalSlaEligible) * 100) : 100;

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalActiveClients,
      nps,
      avgRating,
      slaMetPercentage
    },
    operations: {
      pendingRevisions,
      pendingDeliveries,
      unreadMessagesEscalated
    },
    risks: {
      atRiskClients
    }
  });
}
