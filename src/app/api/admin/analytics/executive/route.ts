import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Revenue
  const currentRevenueQuery = await db.$queryRaw`
    SELECT SUM("totalPayable" * "exchangeRate") as total
    FROM "Invoice"
    WHERE "status" = 'PAID' AND "paidAt" >= ${thirtyDaysAgo} AND "paidAt" <= ${now}
  `;
  const prevRevenueQuery = await db.$queryRaw`
    SELECT SUM("totalPayable" * "exchangeRate") as total
    FROM "Invoice"
    WHERE "status" = 'PAID' AND "paidAt" >= ${sixtyDaysAgo} AND "paidAt" < ${thirtyDaysAgo}
  `;
  
  const currentRevenue = Number((currentRevenueQuery as any[])[0]?.total || 0);
  const prevRevenue = Number((prevRevenueQuery as any[])[0]?.total || 0);
  const revenueTrend = calculateTrend(currentRevenue, prevRevenue);

  // Total Lifetime Revenue for context
  const totalLifetimeRevenueQuery = await db.$queryRaw`
    SELECT SUM("totalPayable" * "exchangeRate") as total
    FROM "Invoice"
    WHERE "status" = 'PAID'
  `;
  const lifetimeRevenue = Number((totalLifetimeRevenueQuery as any[])[0]?.total || 0);

  // 2. Active Clients
  const activeCareerClients = await db.careerClient.count({
    where: { status: { notIn: ['COMPLETED', 'NOT_STARTED', 'REVISION_REQUESTED'] }, lifecycleStatus: 'ACTIVE' }
  });
  const activeRnClients = await db.rnClient.count({
    where: { currentStage: { notIn: ['COMPLETED', 'LAUNCHED', 'NOT_STARTED'] }, lifecycleStatus: 'ACTIVE' }
  });
  const totalActiveClients = activeCareerClients + activeRnClients;

  const currentClientsCreated = await db.careerClient.count({ where: { createdAt: { gte: thirtyDaysAgo } } }) + await db.rnClient.count({ where: { createdAt: { gte: thirtyDaysAgo } } });
  const prevClientsCreated = await db.careerClient.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }) + await db.rnClient.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } });
  const activeClientsTrend = calculateTrend(currentClientsCreated, prevClientsCreated);

  // 3. Client Satisfaction & NPS
  const currentFeedbacks = await db.feedback.findMany({ 
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { npsScore: true, rating: true } 
  });
  const prevFeedbacks = await db.feedback.findMany({ 
    where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    select: { npsScore: true, rating: true } 
  });

  const calcNps = (feedbacks: { npsScore: number, rating: number }[]) => {
    if (feedbacks.length === 0) return null;
    let promoters = 0; let detractors = 0;
    feedbacks.forEach(fb => {
      if (fb.npsScore >= 9) promoters++;
      else if (fb.npsScore <= 6) detractors++;
    });
    return Math.round(((promoters / feedbacks.length) - (detractors / feedbacks.length)) * 100);
  };

  const calcAvgRating = (feedbacks: { npsScore: number, rating: number }[]) => {
    if (feedbacks.length === 0) return null;
    return Number((feedbacks.reduce((acc, fb) => acc + fb.rating, 0) / feedbacks.length).toFixed(1));
  };

  const currentNps = calcNps(currentFeedbacks);
  const prevNps = calcNps(prevFeedbacks);
  const currentAvgRating = calcAvgRating(currentFeedbacks);

  // 4. Pending Deliveries
  const pendingCareerDeliveries = await db.careerDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const pendingRnDeliveries = await db.rnDeliverable.count({ where: { approvalStatus: 'PENDING' }});
  const pendingDeliveries = pendingCareerDeliveries + pendingRnDeliveries;

  const prevPendingCareerDeliveries = await db.careerDeliverable.count({ where: { approvalStatus: 'PENDING', createdAt: { lt: thirtyDaysAgo } }});
  const prevPendingRnDeliveries = await db.rnDeliverable.count({ where: { approvalStatus: 'PENDING', createdAt: { lt: thirtyDaysAgo } }});
  const prevPendingDeliveries = prevPendingCareerDeliveries + prevPendingRnDeliveries;
  
  const pendingTrend = calculateTrend(pendingDeliveries, prevPendingDeliveries);

  return NextResponse.json({
    revenue: {
      value: currentRevenue,
      lifetimeValue: lifetimeRevenue,
      trendPct: revenueTrend,
      trendDirection: revenueTrend >= 0 ? 'up' : 'down',
      context: `Lifetime: ₹${lifetimeRevenue.toLocaleString()}`
    },
    activeClients: {
      value: totalActiveClients,
      trendPct: activeClientsTrend,
      trendDirection: activeClientsTrend >= 0 ? 'up' : 'down',
      context: `Engaged across all services`
    },
    satisfaction: {
      value: currentNps,
      trendPct: currentNps !== null && prevNps !== null ? currentNps - prevNps : 0,
      trendDirection: (currentNps || 0) >= (prevNps || 0) ? 'up' : 'down',
      context: currentAvgRating ? `Avg Rating: ${currentAvgRating} / 5` : 'Insufficient Data'
    },
    deliveries: {
      value: pendingDeliveries,
      trendPct: pendingTrend,
      trendDirection: pendingTrend <= 0 ? 'up' : 'down', // Less pending is better
      context: `Awaiting action`
    }
  });
}
