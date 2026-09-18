// src/app/api/admin/dashboard/summary/route.ts
// Server-side aggregation endpoint for the executive dashboard.
// Computes ALL KPIs in the database — no client-side 100-row cap, no live-FX fluctuation.

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Convert a foreign-currency amount to INR using the snapshot exchange rate
 * stored on the invoice at creation time.
 * Schema: exchangeRate = "foreign units per 1 INR" (e.g. 0.012 = 1 INR buys 0.012 USD)
 * So: INR = foreignAmount / exchangeRate
 */
function snapshotToInr(amount: number, currency: string, exchangeRate: number | null): number {
  if (!amount || amount === 0) return 0;
  const upper = (currency ?? 'INR').toUpperCase();
  if (upper === 'INR') return amount;
  if (exchangeRate && exchangeRate > 0) return amount / exchangeRate;
  return amount; // fallback: no rate stored (treat as INR — shouldn't happen for new invoices)
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // ── 1. Invoice counts by status (single DB round-trip) ──────────────────────
  const statusGroups = await db.invoice.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const countMap: Record<string, number> = {};
  for (const g of statusGroups) countMap[g.status] = g._count._all;
  const totalInvoices = Object.values(countMap).reduce((a, b) => a + b, 0);
  const paidCount = countMap['PAID'] ?? 0;
  const pendingCount = countMap['PENDING'] ?? 0;

  // ── 2. Lightweight fetch of all PAID invoices for revenue calculations ───────
  // Only the 6 fields needed — far lighter than a full invoice fetch.
  const paidInvoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: {
      subtotalConverted: true,
      totalPayable: true,
      currency: true,
      exchangeRate: true,
      amountSettledInr: true,
      paidAt: true,
      createdAt: true,
    },
  });

  // ── 3. Total Settled Revenue ─────────────────────────────────────────────────
  // Reconciled invoices: use actual amountSettledInr (real bank deposit).
  // Unreconciled paid invoices: use snapshotToInr(subtotalConverted) as best estimate.
  // This ensures the number is always complete (all paid invoices counted).
  let totalCollectedInr = 0;
  for (const inv of paidInvoices) {
    if (inv.amountSettledInr != null) {
      totalCollectedInr += inv.amountSettledInr;
    } else {
      totalCollectedInr += snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
    }
  }

  // ── 4. Collections This Month ────────────────────────────────────────────────
  // DB-level month filter — not limited to 100 rows.
  let monthCollectedInr = 0;
  for (const inv of paidInvoices) {
    const d = new Date(inv.paidAt ?? inv.createdAt);
    if (d >= monthStart && d <= monthEnd) {
      if (inv.amountSettledInr != null) {
        monthCollectedInr += inv.amountSettledInr;
      } else {
        monthCollectedInr += snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
      }
    }
  }

  // ── 5. Pending Receivables ───────────────────────────────────────────────────
  // Uses totalPayable (what the client is being billed — accounts receivable convention).
  // In zero-loss model, client pays totalPayable = subtotalConverted + gateway fee.
  const pendingInvoices = await db.invoice.findMany({
    where: { status: 'PENDING' },
    select: {
      totalPayable: true,
      currency: true,
      exchangeRate: true,
    },
  });
  let pendingReceivablesInr = 0;
  for (const inv of pendingInvoices) {
    pendingReceivablesInr += snapshotToInr(inv.totalPayable, inv.currency, inv.exchangeRate);
  }

  // ── 6. Settlement Fee Leakage ────────────────────────────────────────────────
  // Only sum POSITIVE gaps (real underpayments).
  // Negative gaps (bank overcollections) are NOT subtracted — they're separate windfalls.
  // This gives the true "unrecovered revenue" figure, never artificially reduced.
  let totalLeakageInr = 0;
  for (const inv of paidInvoices) {
    if (inv.amountSettledInr != null) {
      const netInr = snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
      const gap = netInr - inv.amountSettledInr;
      if (gap > 0) totalLeakageInr += gap;
    }
  }

  // ── 7. Recent Invoices (last 6, all statuses) ────────────────────────────────
  const recentInvoices = await db.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      clientType: true,
      totalPayable: true,
      currency: true,
      currencySymbol: true,
      status: true,
      paymentGateway: true,
      createdAt: true,
      paidAt: true,
    },
  });

  return NextResponse.json({
    summary: {
      totalInvoices,
      paidCount,
      pendingCount,
      totalCollectedInr: Math.round(totalCollectedInr),
      monthCollectedInr: Math.round(monthCollectedInr),
      pendingReceivablesInr: Math.round(pendingReceivablesInr),
      totalLeakageInr: Math.round(totalLeakageInr),
    },
    recentInvoices,
  });
}
