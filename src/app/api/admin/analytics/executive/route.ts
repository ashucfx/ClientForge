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

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');

  let currentStart: Date;
  let currentEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let yearStart: Date;
  let yearEnd: Date;

  if (monthParam) {
    const [y, m] = monthParam.split('-');
    const year = parseInt(y);
    const month = parseInt(m) - 1; // 0-indexed
    currentStart = new Date(year, month, 1);
    currentEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    prevStart = new Date(year, month - 1, 1);
    prevEnd = new Date(year, month, 0, 23, 59, 59, 999);

    yearStart = new Date(year, 0, 1);
    yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    const now = new Date();
    currentEnd = now;
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevEnd = currentStart;
    prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    yearStart = new Date(now.getFullYear(), 0, 1);
    yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  // Fetch Reconciled Invoices
  const allInvoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: { subtotalConverted: true, currency: true, amountSettledInr: true, paidAt: true, settledAt: true }
  });
  
  const allCareer = await db.careerClient.findMany({
    where: { amountPaid: { gt: 0 } },
    select: { amountPaid: true, currency: true, amountSettledInr: true, createdAt: true, settledAt: true }
  });

  const allRn = await db.rnClient.findMany({
    where: { amountPaid: { gt: 0 } },
    select: { amountPaid: true, currency: true, amountSettledInr: true, createdAt: true, settledAt: true }
  });

  let lifetimeRevenue = 0;
  let currentPeriodRevenue = 0;
  let prevPeriodRevenue = 0;

  let monthlyLeakage = 0;
  let annualLeakage = 0;
  
  const rawMap = new Map<string, number>();
  const addBreakdown = (cur: string | null, amt: number) => {
    const c = cur?.toUpperCase() ?? 'INR';
    rawMap.set(c, (rawMap.get(c) ?? 0) + amt);
  };

  for (const inv of allInvoices) {
    // Only count as revenue if it is settled!
    if (inv.amountSettledInr !== null) {
      const settledAmt = inv.amountSettledInr;
      lifetimeRevenue += settledAmt;
      addBreakdown(inv.currency, inv.subtotalConverted);

      const effectiveDate = inv.paidAt || inv.settledAt || new Date(0);

      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) currentPeriodRevenue += settledAmt;
      if (effectiveDate >= prevStart && effectiveDate <= prevEnd) prevPeriodRevenue += settledAmt;

      // Leakage calculation
      const expectedInr = await amountToInr(inv.subtotalConverted, inv.currency);
      const gap = Math.max(0, expectedInr - settledAmt);
      
      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) monthlyLeakage += gap;
      if (effectiveDate >= yearStart && effectiveDate <= yearEnd) annualLeakage += gap;
    }
  }

  // Same for Career
  for (const c of allCareer) {
    if (c.amountSettledInr !== null) {
      const settledAmt = c.amountSettledInr;
      lifetimeRevenue += settledAmt;
      addBreakdown(c.currency, c.amountPaid);
      
      const effectiveDate = c.createdAt || c.settledAt || new Date(0);

      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) currentPeriodRevenue += settledAmt;
      if (effectiveDate >= prevStart && effectiveDate <= prevEnd) prevPeriodRevenue += settledAmt;

      const expectedInr = await amountToInr(c.amountPaid, c.currency || 'INR');
      const gap = Math.max(0, expectedInr - settledAmt);
      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) monthlyLeakage += gap;
      if (effectiveDate >= yearStart && effectiveDate <= yearEnd) annualLeakage += gap;
    }
  }

  // Same for RN
  for (const c of allRn) {
    if (c.amountSettledInr !== null) {
      const settledAmt = c.amountSettledInr;
      lifetimeRevenue += settledAmt;
      addBreakdown(c.currency, c.amountPaid);
      
      const effectiveDate = c.createdAt || c.settledAt || new Date(0);

      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) currentPeriodRevenue += settledAmt;
      if (effectiveDate >= prevStart && effectiveDate <= prevEnd) prevPeriodRevenue += settledAmt;

      const expectedInr = await amountToInr(c.amountPaid, c.currency || 'INR');
      const gap = Math.max(0, expectedInr - settledAmt);
      if (effectiveDate >= currentStart && effectiveDate <= currentEnd) monthlyLeakage += gap;
      if (effectiveDate >= yearStart && effectiveDate <= yearEnd) annualLeakage += gap;
    }
  }

  const revenueTrendPct = calculateTrend(currentPeriodRevenue, prevPeriodRevenue);

  const { rates: inrRates, source: rateSource } = await getInrRates();
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
    db.careerClient.count({ where: { ...activeWhere, createdAt: { gte: currentStart, lte: currentEnd } } }),
    db.rnClient.count({ where: { ...activeRnWhere, createdAt: { gte: currentStart, lte: currentEnd } } }),
    db.careerClient.count({ where: { ...activeWhere, createdAt: { gte: prevStart, lt: currentStart } } }),
    db.rnClient.count({ where: { ...activeRnWhere, createdAt: { gte: prevStart, lt: currentStart } } }),
  ]);

  const totalActiveClients    = activeCareerClients + activeRnClients;
  const currentClientsCreated = activeCareerCurrent + activeRnCurrent;
  const prevClientsCreated    = activeCareerPrev + activeRnPrev;
  const activeClientsTrend    = calculateTrend(currentClientsCreated, prevClientsCreated);

  // ── 3. Satisfaction & NPS ──────────────────────────────────────────────────
  const [currentFeedbacks, prevFeedbacks] = await Promise.all([
    db.feedback.findMany({ where: { createdAt: { gte: currentStart, lte: currentEnd } }, select: { npsScore: true, rating: true } }),
    db.feedback.findMany({ where: { createdAt: { gte: prevStart, lt: currentStart } }, select: { npsScore: true, rating: true } }),
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
      periodValue: Math.round(currentPeriodRevenue),
      monthlyLeakageInr: Math.round(monthlyLeakage),
      annualLeakageInr: Math.round(annualLeakage),
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
