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
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Revenue — computed from PAID invoices, not stale FlywheelProfile aggregates
  const [lifetimeRevenueAggr, currentPeriodRevenueAggr, prevPeriodRevenueAggr] = await Promise.all([
    db.invoice.aggregate({
      _sum: { totalPayable: true },
      where: { status: 'PAID' },
    }),
    db.invoice.aggregate({
      _sum: { totalPayable: true },
      where: { status: 'PAID', paidAt: { gte: thirtyDaysAgo } },
    }),
    db.invoice.aggregate({
      _sum: { totalPayable: true },
      where: { status: 'PAID', paidAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
  ]);

  const lifetimeRevenue      = Number(lifetimeRevenueAggr._sum.totalPayable || 0);
  const currentPeriodRevenue = Number(currentPeriodRevenueAggr._sum.totalPayable || 0);
  const prevPeriodRevenue    = Number(prevPeriodRevenueAggr._sum.totalPayable || 0);
  const revenueTrendPct      = calculateTrend(currentPeriodRevenue, prevPeriodRevenue);

  // 2. Active Clients
  const [activeCareerClients, activeRnClients, currentClientsCreated, prevClientsCreated] = await Promise.all([
    db.careerClient.count({
      where: { status: { notIn: ['COMPLETED', 'NOT_STARTED', 'REVISION_REQUESTED'] }, lifecycleStatus: 'ACTIVE' },
    }),
    db.rnClient.count({
      where: { currentStage: { notIn: ['COMPLETED', 'LAUNCHED', 'NOT_STARTED'] }, lifecycleStatus: 'ACTIVE' },
    }),
    db.careerClient.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
      .then(async c => c + await db.rnClient.count({ where: { createdAt: { gte: thirtyDaysAgo } } })),
    db.careerClient.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } })
      .then(async c => c + await db.rnClient.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } })),
  ]);

  const totalActiveClients = activeCareerClients + activeRnClients;
  const activeClientsTrend = calculateTrend(currentClientsCreated, prevClientsCreated);

  // 3. Client Satisfaction & NPS
  const [currentFeedbacks, prevFeedbacks] = await Promise.all([
    db.feedback.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { npsScore: true, rating: true },
    }),
    db.feedback.findMany({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      select: { npsScore: true, rating: true },
    }),
  ]);

  const calcNps = (feedbacks: { npsScore: number; rating: number }[]) => {
    if (feedbacks.length === 0) return null;
    let promoters = 0; let detractors = 0;
    feedbacks.forEach(fb => {
      if (fb.npsScore >= 9) promoters++;
      else if (fb.npsScore <= 6) detractors++;
    });
    return Math.round(((promoters / feedbacks.length) - (detractors / feedbacks.length)) * 100);
  };

  const calcAvgRating = (feedbacks: { npsScore: number; rating: number }[]) => {
    if (feedbacks.length === 0) return null;
    return Number((feedbacks.reduce((acc, fb) => acc + fb.rating, 0) / feedbacks.length).toFixed(1));
  };

  const currentNps    = calcNps(currentFeedbacks);
  const prevNps       = calcNps(prevFeedbacks);
  const currentAvgRating = calcAvgRating(currentFeedbacks);
  const npsTrend      = currentNps !== null && prevNps !== null ? currentNps - prevNps : 0;

  // 4. Pipeline Value
  const pipelineValueAggr = await db.flywheelProfile.aggregate({
    _sum: { dealValue: true },
    where: { lifecycleStage: { in: ['LEAD', 'MQL', 'SQL'] } },
  });
  const pipelineValue = Number(pipelineValueAggr._sum.dealValue || 0);

  return NextResponse.json({
    revenue: {
      value: lifetimeRevenue,
      lifetimeValue: lifetimeRevenue,
      trendPct: revenueTrendPct,
      trendDirection: revenueTrendPct >= 0 ? 'up' : 'down',
      context: `Global Lifetime Value · ${currentPeriodRevenue > 0 ? `+${revenueTrendPct}% vs last 30d` : 'No revenue this period'}`,
    },
    activeClients: {
      value: totalActiveClients,
      trendPct: activeClientsTrend,
      trendDirection: activeClientsTrend >= 0 ? 'up' : 'down',
      context: `Engaged across all services`,
    },
    satisfaction: {
      value: currentNps,
      trendPct: npsTrend,
      trendDirection: npsTrend >= 0 ? 'up' : 'down',
      context: currentAvgRating ? `Avg Rating: ${currentAvgRating} / 5` : 'Insufficient Data',
    },
    pipeline: {
      value: pipelineValue,
      trendPct: undefined,
      trendDirection: undefined,
      context: `Potential deal value in active pipeline`,
    },
  });
}
