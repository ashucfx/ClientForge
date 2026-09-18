// src/app/api/admin/reconciliation/dashboard/route.ts
// GET — Returns all transactions with settlement data for the Reconciliation Dashboard.
// Aggregates invoices + manual career/RN clients, computes fee gaps, leakage stats.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

/**
 * Convert a foreign-currency amount to INR using the SNAPSHOT exchange rate
 * stored on the invoice at creation time.
 *
 * The schema stores exchangeRate as "foreign units per 1 INR" (e.g. USD 0.012 means
 * 1 INR = 0.012 USD, so 1 USD = 1/0.012 INR ≈ 83.33 INR).
 *
 * Using the snapshot rate makes leakage stable and deterministic — it never
 * fluctuates with live FX movement after the invoice is settled.
 *
 * Falls back to live amountToInr() when no snapshot rate is available.
 */
async function snapshotToInr(
  amount: number,
  currency: string,
  snapshotRate: number | null | undefined,
): Promise<number> {
  if (!amount || amount === 0) return 0;
  const upper = (currency ?? 'INR').toUpperCase();
  if (upper === 'INR') return amount;
  // Use stored snapshot rate: rate = foreign / INR → INR = foreign / rate
  if (snapshotRate && snapshotRate > 0) return amount / snapshotRate;
  // Fallback to live rate if no snapshot (legacy invoices without exchangeRate)
  return amountToInr(amount, currency);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const fromDate = sp.get('from') ? new Date(sp.get('from')!) : undefined;
  const toDate = sp.get('to') ? new Date(sp.get('to')!) : undefined;
  const reconciled = sp.get('reconciled'); // 'yes' | 'no' | null (all)

  // ── 1. All paid invoices ────────────────────────────────────────────────────
  const invoices = await db.invoice.findMany({
    where: {
      status: 'PAID',
      ...(fromDate || toDate ? {
        paidAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      } : {}),
      ...(reconciled === 'yes' ? { amountSettledInr: { not: null } } : {}),
      ...(reconciled === 'no' ? { amountSettledInr: null } : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      totalPayable: true,
      subtotalConverted: true,
      processingFeeConverted: true,
      taxAmount: true,
      discountAmount: true,
      currency: true,
      currencySymbol: true,
      exchangeRate: true,
      paymentGateway: true,
      brandId: true,
      paidAt: true,
      amountSettledInr: true,
      settlementNote: true,
      settledAt: true,
    },
    orderBy: { paidAt: 'desc' },
  });

  // ── 2. All manual career clients ────────────────────────────────────────────
  const manualCareer = await db.careerClient.findMany({
    where: {
      invoiceId: null,
      amountPaid: { gt: 0 },
      ...(fromDate || toDate ? {
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      } : {}),
      ...(reconciled === 'yes' ? { amountSettledInr: { not: null } } : {}),
      ...(reconciled === 'no' ? { amountSettledInr: null } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      amountPaid: true,
      currency: true,
      packageType: true,
      createdAt: true,
      amountSettledInr: true,
      settlementNote: true,
      settledAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── 3. All manual RN clients ────────────────────────────────────────────────
  const manualRn = await db.rnClient.findMany({
    where: {
      invoiceId: null,
      amountPaid: { gt: 0 },
      ...(fromDate || toDate ? {
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      } : {}),
      ...(reconciled === 'yes' ? { amountSettledInr: { not: null } } : {}),
      ...(reconciled === 'no' ? { amountSettledInr: null } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      amountPaid: true,
      currency: true,
      createdAt: true,
      amountSettledInr: true,
      settlementNote: true,
      settledAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── 4. Convert all to INR and compute gaps ──────────────────────────────────
  const invoiceRows = await Promise.all(
    invoices.map(async (inv) => {
      // Use stored snapshot exchange rate so leakage never fluctuates with live FX.
      const grossInr = Math.round(await snapshotToInr(inv.totalPayable, inv.currency, inv.exchangeRate));
      const netInr = Math.round(await snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate));
      const feeInr = grossInr - netInr;
      const settledInr = inv.amountSettledInr ?? null;
      const gapInr = settledInr !== null ? netInr - settledInr : null;
      const gapPct = settledInr !== null && netInr > 0
        ? Math.round(((netInr - settledInr) / netInr) * 100 * 10) / 10
        : null;
      return {
        rowId: inv.id,
        type: 'invoice' as const,
        ref: inv.invoiceNumber,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        gateway: inv.paymentGateway,
        brand: inv.brandId,
        currency: inv.currency,
        grossInr,
        netInr,
        feeInr,
        settledInr,
        gapInr,
        gapPct,
        date: inv.paidAt?.toISOString() ?? null,
        settlementNote: inv.settlementNote,
        settledAt: inv.settledAt?.toISOString() ?? null,
        isReconciled: settledInr !== null,
      };
    })
  );

  const careerRows = await Promise.all(
    manualCareer.map(async (c) => {
      const grossInr = Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR'));
      const settledInr = c.amountSettledInr ?? null;
      const gapInr = settledInr !== null ? grossInr - settledInr : null;
      const gapPct = settledInr !== null && grossInr > 0
        ? Math.round(((grossInr - settledInr) / grossInr) * 100 * 10) / 10
        : null;
      return {
        rowId: c.id,
        type: 'career_manual' as const,
        ref: `CAREER-${c.id.slice(0, 8).toUpperCase()}`,
        clientName: c.name,
        clientEmail: c.email,
        gateway: 'MANUAL',
        brand: 'catalyst',
        currency: c.currency ?? 'INR',
        grossInr,
        netInr: grossInr, // for manual clients, no separate fee deducted at invoice level
        feeInr: 0,
        settledInr,
        gapInr,
        gapPct,
        date: c.createdAt.toISOString(),
        settlementNote: c.settlementNote,
        settledAt: c.settledAt?.toISOString() ?? null,
        isReconciled: settledInr !== null,
      };
    })
  );

  const rnRows = await Promise.all(
    manualRn.map(async (c) => {
      const grossInr = Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR'));
      const settledInr = c.amountSettledInr ?? null;
      const gapInr = settledInr !== null ? grossInr - settledInr : null;
      const gapPct = settledInr !== null && grossInr > 0
        ? Math.round(((grossInr - settledInr) / grossInr) * 100 * 10) / 10
        : null;
      return {
        rowId: c.id,
        type: 'rn_manual' as const,
        ref: `RN-${c.id.slice(0, 8).toUpperCase()}`,
        clientName: c.name,
        clientEmail: c.email,
        gateway: 'MANUAL',
        brand: 'ripple_nexus',
        currency: c.currency ?? 'INR',
        grossInr,
        netInr: grossInr,
        feeInr: 0,
        settledInr,
        gapInr,
        gapPct,
        date: c.createdAt.toISOString(),
        settlementNote: c.settlementNote,
        settledAt: c.settledAt?.toISOString() ?? null,
        isReconciled: settledInr !== null,
      };
    })
  );

  const allRows = [...invoiceRows, ...careerRows, ...rnRows]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  // ── 5. Summary statistics ───────────────────────────────────────────────────
  const reconciledRows = allRows.filter(r => r.isReconciled);
  const unreconciledRows = allRows.filter(r => !r.isReconciled);

  const totalGrossInr = allRows.reduce((s, r) => s + r.grossInr, 0);
  const totalNetInr = allRows.reduce((s, r) => s + r.netInr, 0);
  const totalSettledInr = reconciledRows.reduce((s, r) => s + (r.settledInr ?? 0), 0);

  // BUG 6 FIX: Only sum POSITIVE gaps (real underpayments) for leakage.
  // Negative gaps (bank overcollections) are tracked separately — they must
  // NOT cancel out real leakage. Both are surfaced individually.
  let totalLeakageInr = 0; // positive gaps only — real fee underpayments
  let totalOvercollectedInr = 0; // negative gaps — bank paid more than expected
  for (const r of reconciledRows) {
    const gap = r.gapInr ?? 0;
    if (gap > 0) totalLeakageInr += gap;
    else if (gap < 0) totalOvercollectedInr += Math.abs(gap);
  }
  // Keep totalGapInr as net for backward compat (used in row-level display)
  const totalGapInr = totalLeakageInr - totalOvercollectedInr;
  const avgGapPct = reconciledRows.length > 0
    ? Math.round(
        (reconciledRows.reduce((s, r) => s + (r.gapPct ?? 0), 0) / reconciledRows.length) * 10
      ) / 10
    : null;

  // Gateway-level breakdown (only from reconciled rows to show real fee %)
  const gatewayMap: Record<string, { gross: number; settled: number; count: number }> = {};
  for (const row of reconciledRows) {
    const gw = row.gateway ?? 'UNKNOWN';
    if (!gatewayMap[gw]) gatewayMap[gw] = { gross: 0, settled: 0, count: 0 };
    gatewayMap[gw].gross += row.netInr;
    gatewayMap[gw].settled += row.settledInr ?? 0;
    gatewayMap[gw].count += 1;
  }
  const byGateway = Object.entries(gatewayMap).map(([gateway, v]) => ({
    gateway,
    netInr: Math.round(v.gross),
    settledInr: Math.round(v.settled),
    gapInr: Math.round(v.gross - v.settled),
    effectiveFeeRate: v.gross > 0 ? Math.round(((v.gross - v.settled) / v.gross) * 100 * 100) / 100 : 0,
    count: v.count,
  }));

  // ── 6. All-Time Leakage (if filtered by date) ──────────────────────────────
  let allTimeTotalGapInr = Math.round(totalGapInr);
  let allTimeLeakageInr = Math.round(totalLeakageInr);
  
  if (fromDate || toDate) {
    const allReconciledInvoices = await db.invoice.findMany({
      where: { status: 'PAID', amountSettledInr: { not: null } },
      select: { subtotalConverted: true, currency: true, exchangeRate: true, amountSettledInr: true }
    });
    const allReconciledCareer = await db.careerClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, amountSettledInr: { not: null } },
      select: { amountPaid: true, currency: true, amountSettledInr: true }
    });
    const allReconciledRn = await db.rnClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, amountSettledInr: { not: null } },
      select: { amountPaid: true, currency: true, amountSettledInr: true }
    });

    let allTimeLeak = 0;
    let allTimeNet = 0;
    for (const inv of allReconciledInvoices) {
      const net = await snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
      allTimeNet += net;
      const gap = net - (inv.amountSettledInr ?? 0);
      if (gap > 0) allTimeLeak += gap;
    }
    for (const c of allReconciledCareer) {
      const net = await amountToInr(c.amountPaid, c.currency ?? 'INR');
      allTimeNet += net;
      const gap = net - (c.amountSettledInr ?? 0);
      if (gap > 0) allTimeLeak += gap;
    }
    for (const c of allReconciledRn) {
      const net = await amountToInr(c.amountPaid, c.currency ?? 'INR');
      allTimeNet += net;
      const gap = net - (c.amountSettledInr ?? 0);
      if (gap > 0) allTimeLeak += gap;
    }
    
    const allTimeSettled = 
      allReconciledInvoices.reduce((s, i) => s + (i.amountSettledInr ?? 0), 0) +
      allReconciledCareer.reduce((s, i) => s + (i.amountSettledInr ?? 0), 0) +
      allReconciledRn.reduce((s, i) => s + (i.amountSettledInr ?? 0), 0);
      
    allTimeTotalGapInr = Math.round(allTimeNet - allTimeSettled);
    allTimeLeakageInr = Math.round(allTimeLeak);
  }

  return NextResponse.json({
    rows: allRows,
    summary: {
      totalTransactions: allRows.length,
      reconciledCount: reconciledRows.length,
      unreconciledCount: unreconciledRows.length,
      totalGrossInr: Math.round(totalGrossInr),
      totalNetInr: Math.round(totalNetInr),
      totalSettledInr: Math.round(totalSettledInr),
      totalGapInr: Math.round(totalGapInr),           // net (can be negative if overcollected)
      totalLeakageInr: Math.round(totalLeakageInr),   // positive gaps only — real underpayments
      totalOvercollectedInr: Math.round(totalOvercollectedInr), // negative gaps — bank paid extra
      allTimeTotalGapInr,
      allTimeLeakageInr,
      avgGapPct,
      byGateway,
    },
  });
}
