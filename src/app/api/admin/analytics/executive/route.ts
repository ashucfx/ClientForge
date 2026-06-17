import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

// Approximate rates to INR for display purposes (updated periodically)
const TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83,
  GBP: 106,
  EUR: 90,
  SGD: 62,
  AUD: 54,
  CAD: 61,
  AED: 22.6,
};

function toInr(amount: number, currency: string): number {
  return amount * (TO_INR[currency.toUpperCase()] ?? 83); // default USD rate for unknowns
}

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

  // 1. Revenue — group by currency so we can convert correctly
  const [lifetimeByCurrency, currentByCurrency, prevByCurrency] = await Promise.all([
    db.$queryRaw<Array<{ currency: string; total: string }>>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0) AS total
      FROM "Invoice" WHERE "status" = 'PAID'
      GROUP BY "currency"
    `,
    db.$queryRaw<Array<{ currency: string; total: string }>>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0) AS total
      FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    db.$queryRaw<Array<{ currency: string; total: string }>>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0) AS total
      FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${sixtyDaysAgo} AND "paidAt" < ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
  ]);

  // Sum each period into INR-equivalent total
  const sumInr = (rows: Array<{ currency: string; total: string }>) =>
    rows.reduce((acc, r) => acc + toInr(Number(r.total), r.currency), 0);

  const lifetimeRevenue      = sumInr(lifetimeByCurrency);
  const currentPeriodRevenue = sumInr(currentByCurrency);
  const prevPeriodRevenue    = sumInr(prevByCurrency);
  const revenueTrendPct      = calculateTrend(currentPeriodRevenue, prevPeriodRevenue);

  // Build per-currency breakdown for display
  const currencyBreakdown = lifetimeByCurrency.map(r => ({
    currency: r.currency,
    amount: Number(r.total),
    inrEquivalent: toInr(Number(r.total), r.currency),
  })).sort((a, b) => b.inrEquivalent - a.inrEquivalent);

  // 2. Active Clients
  const activeWhere   = { status: { notIn: ['COMPLETED', 'NOT_STARTED', 'REVISION_REQUESTED'] as never[] }, lifecycleStatus: 'ACTIVE' as const };
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

  // 3. Satisfaction & NPS
  const [currentFeedbacks, prevFeedbacks] = await Promise.all([
    db.feedback.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { npsScore: true, rating: true } }),
    db.feedback.findMany({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }, select: { npsScore: true, rating: true } }),
  ]);

  const calcNps = (fbs: { npsScore: number }[]) => {
    if (!fbs.length) return null;
    let p = 0, d = 0;
    fbs.forEach(f => { if (f.npsScore >= 9) p++; else if (f.npsScore <= 6) d++; });
    return Math.round(((p / fbs.length) - (d / fbs.length)) * 100);
  };
  const calcAvgRating = (fbs: { rating: number }[]) =>
    fbs.length ? Number((fbs.reduce((a, f) => a + f.rating, 0) / fbs.length).toFixed(1)) : null;

  const currentNps    = calcNps(currentFeedbacks);
  const prevNps       = calcNps(prevFeedbacks);
  const currentAvgRating = calcAvgRating(currentFeedbacks);
  const npsTrend      = currentNps !== null && prevNps !== null ? currentNps - prevNps : 0;

  // 4. Pipeline Value (INR-equivalent)
  const pipelineProfiles = await db.flywheelProfile.findMany({
    where: { lifecycleStage: { in: ['LEAD', 'MQL', 'SQL'] }, dealValue: { gt: 0 } },
    select: { dealValue: true },
  });
  const pipelineValue = pipelineProfiles.reduce((acc, p) => acc + Number(p.dealValue ?? 0), 0);

  // Context string showing breakdown
  const breakdownStr = currencyBreakdown
    .slice(0, 3)
    .map(b => `${b.currency} ${b.amount.toLocaleString()}`)
    .join(' · ');

  return NextResponse.json({
    revenue: {
      value: Math.round(lifetimeRevenue),
      lifetimeValue: Math.round(lifetimeRevenue),
      trendPct: revenueTrendPct,
      trendDirection: revenueTrendPct >= 0 ? 'up' : 'down',
      context: `≈ INR equivalent · ${breakdownStr || 'No paid invoices'}`,
      currencyBreakdown,
    },
    activeClients: {
      value: totalActiveClients,
      trendPct: activeClientsTrend,
      trendDirection: activeClientsTrend >= 0 ? 'up' : 'down',
      context: 'Engaged across all services',
    },
    satisfaction: {
      value: currentNps,
      trendPct: npsTrend,
      trendDirection: npsTrend >= 0 ? 'up' : 'down',
      context: currentAvgRating ? `Avg Rating: ${currentAvgRating} / 5` : 'Insufficient Data',
    },
    pipeline: {
      value: Math.round(pipelineValue),
      trendPct: undefined,
      trendDirection: undefined,
      context: 'Potential deal value in active pipeline',
    },
  });
}
