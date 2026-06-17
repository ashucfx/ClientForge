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

  // 1. Revenue — currency-normalized (totalPayable * exchangeRate → base INR equivalent)
  const [lifetimeRev, currentRev, prevRev] = await Promise.all([
    db.$queryRaw<[{ total: string }]>`SELECT COALESCE(SUM("totalPayable" * "exchangeRate"), 0) AS total FROM "Invoice" WHERE "status" = 'PAID'`,
    db.$queryRaw<[{ total: string }]>`SELECT COALESCE(SUM("totalPayable" * "exchangeRate"), 0) AS total FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${thirtyDaysAgo}`,
    db.$queryRaw<[{ total: string }]>`SELECT COALESCE(SUM("totalPayable" * "exchangeRate"), 0) AS total FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${sixtyDaysAgo} AND "paidAt" < ${thirtyDaysAgo}`,
  ]);

  const lifetimeRevenue      = Number(lifetimeRev[0]?.total || 0);
  const currentPeriodRevenue = Number(currentRev[0]?.total || 0);
  const prevPeriodRevenue    = Number(prevRev[0]?.total || 0);
  const revenueTrendPct      = calculateTrend(currentPeriodRevenue, prevPeriodRevenue);

  // 2. Active Clients — compare active count this period vs prior period
  const activeWhere = { status: { notIn: ['COMPLETED', 'NOT_STARTED', 'REVISION_REQUESTED'] as never[] }, lifecycleStatus: 'ACTIVE' as const };
  const activeRnWhere = { currentStage: { notIn: ['COMPLETED', 'LAUNCHED', 'NOT_STARTED'] }, lifecycleStatus: 'ACTIVE' as const };

  const [activeCareerClients, activeRnClients, activeCareerCurrent, activeRnCurrent, activeCareerPrev, activeRnPrev] = await Promise.all([
    db.careerClient.count({ where: activeWhere }),
    db.rnClient.count({ where: activeRnWhere }),
    db.careerClient.count({ where: { ...activeWhere, createdAt: { gte: thirtyDaysAgo } } }),
    db.rnClient.count({ where: { ...activeRnWhere, createdAt: { gte: thirtyDaysAgo } } }),
    db.careerClient.count({ where: { ...activeWhere, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.rnClient.count({ where: { ...activeRnWhere, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
  ]);

  const totalActiveClients    = activeCareerClients + activeRnClients;
  const currentClientsCreated = activeCareerCurrent + activeRnCurrent;
  const prevClientsCreated    = activeCareerPrev + activeRnPrev;
  const activeClientsTrend    = calculateTrend(currentClientsCreated, prevClientsCreated);

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
