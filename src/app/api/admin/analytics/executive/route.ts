import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr, getInrRates } from '@/lib/fx';

export const runtime = 'nodejs';

type CurrencyGroup = { currency: string; total: string };

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function groupsToInr(rows: CurrencyGroup[]): Promise<number> {
  const amounts = await Promise.all(rows.map(r => amountToInr(Number(r.total), r.currency)));
  return amounts.reduce((a, b) => a + b, 0);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // ── 1. Revenue from all three sources ──────────────────────────────────────
  // Source A: Portal invoices (marked PAID)
  // Source B: Career clients onboarded outside the portal (invoiceId IS NULL + amountPaid > 0)
  // Source C: RN clients onboarded outside the portal (same logic)
  const [
    invoiceLifetime, invoiceCurrent, invoicePrev,
    careerLifetime,  careerCurrent,  careerPrev,
    rnLifetime,      rnCurrent,      rnPrev,
  ] = await Promise.all([
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0)::text AS total
      FROM "Invoice" WHERE "status" = 'PAID'
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0)::text AS total
      FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("totalPayable"), 0)::text AS total
      FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${sixtyDaysAgo} AND "paidAt" < ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    // Career clients manually onboarded (no portal invoice)
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "CareerClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "CareerClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0 AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "CareerClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0 AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    // RN clients manually onboarded (no portal invoice)
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "RnClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "RnClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0 AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
    db.$queryRaw<CurrencyGroup[]>`
      SELECT "currency", COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "RnClient" WHERE "invoiceId" IS NULL AND "amountPaid" > 0 AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}
      GROUP BY "currency"
    `,
  ]);

  // Convert each source to INR using live rates (shared cache, single API call)
  const [
    invoiceLifetimeInr, invoiceCurrentInr, invoicePrevInr,
    careerLifetimeInr,  careerCurrentInr,  careerPrevInr,
    rnLifetimeInr,      rnCurrentInr,      rnPrevInr,
  ] = await Promise.all([
    groupsToInr(invoiceLifetime),
    groupsToInr(invoiceCurrent),
    groupsToInr(invoicePrev),
    groupsToInr(careerLifetime),
    groupsToInr(careerCurrent),
    groupsToInr(careerPrev),
    groupsToInr(rnLifetime),
    groupsToInr(rnCurrent),
    groupsToInr(rnPrev),
  ]);

  const lifetimeRevenue      = invoiceLifetimeInr + careerLifetimeInr + rnLifetimeInr;
  const currentPeriodRevenue = invoiceCurrentInr  + careerCurrentInr  + rnCurrentInr;
  const prevPeriodRevenue    = invoicePrevInr     + careerPrevInr     + rnPrevInr;
  const revenueTrendPct      = calculateTrend(currentPeriodRevenue, prevPeriodRevenue);

  // Build per-currency breakdown across all three sources
  const { rates: inrRates, source: rateSource } = await getInrRates();
  const rawMap = new Map<string, number>();
  const addRows = (rows: CurrencyGroup[]) => {
    rows.forEach(r => {
      const cur = r.currency?.toUpperCase() ?? 'INR';
      rawMap.set(cur, (rawMap.get(cur) ?? 0) + Number(r.total));
    });
  };
  addRows(invoiceLifetime);
  addRows(careerLifetime);
  addRows(rnLifetime);

  const currencyBreakdown = Array.from(rawMap.entries())
    .map(([currency, amount]) => ({
      currency,
      amount,
      inrEquivalent: Math.round(amount * (inrRates[currency] ?? inrRates['USD'] ?? 83.5)),
    }))
    .sort((a, b) => b.inrEquivalent - a.inrEquivalent);

  const breakdownStr = currencyBreakdown
    .slice(0, 3)
    .map(b => `${b.currency} ${b.amount.toLocaleString()}`)
    .join(' · ');

  // ── 2. Active Clients ──────────────────────────────────────────────────────
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

  // ── 3. Satisfaction & NPS ──────────────────────────────────────────────────
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

  const currentNps       = calcNps(currentFeedbacks);
  const prevNps          = calcNps(prevFeedbacks);
  const currentAvgRating = calcAvgRating(currentFeedbacks);
  const npsTrend         = currentNps !== null && prevNps !== null ? currentNps - prevNps : 0;

  // ── 4. Pipeline Value ──────────────────────────────────────────────────────
  const pipelineProfiles = await db.flywheelProfile.findMany({
    where: { lifecycleStage: { in: ['LEAD', 'MQL', 'SQL'] }, dealValue: { gt: 0 } },
    select: { dealValue: true },
  });
  const pipelineValue = pipelineProfiles.reduce((acc, p) => acc + Number(p.dealValue ?? 0), 0);

  return NextResponse.json({
    revenue: {
      value: Math.round(lifetimeRevenue),
      lifetimeValue: Math.round(lifetimeRevenue),
      invoiceRevenue: Math.round(invoiceLifetimeInr),
      externalRevenue: Math.round(careerLifetimeInr + rnLifetimeInr),
      trendPct: revenueTrendPct,
      trendDirection: revenueTrendPct >= 0 ? 'up' : 'down',
      context: `≈ INR · ${breakdownStr || 'No revenue recorded'} · rates: ${rateSource}`,
      currencyBreakdown,
      rateSource,
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
