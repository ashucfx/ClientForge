// src/app/api/admin/dashboard/summary/route.ts
// Server-side aggregation endpoint for the executive dashboard.
// Computes ALL KPIs in the database — no client-side 100-row cap, no live-FX fluctuation.

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

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

  // ── 2. Fetch all PAID invoices for revenue & leakage calculations ────────────
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

  // ── 3. Fetch manual Career & RN clients (not linked to an invoice) ───────────
  const manualCareer = await db.careerClient.findMany({
    where: {
      invoiceId: null,
      amountPaid: { gt: 0 },
    },
    select: {
      amountPaid: true,
      currency: true,
      amountSettledInr: true,
      createdAt: true,
    },
  });

  const manualRn = await db.rnClient.findMany({
    where: {
      invoiceId: null,
      amountPaid: { gt: 0 },
    },
    select: {
      amountPaid: true,
      currency: true,
      amountSettledInr: true,
      createdAt: true,
    },
  });

  // ── 4. Total Settled Revenue ─────────────────────────────────────────────────
  // Reconciled invoices: use actual amountSettledInr (real bank deposit).
  // Unreconciled paid invoices: use snapshotToInr(subtotalConverted) as best estimate.
  let totalCollectedInr = 0;
  for (const inv of paidInvoices) {
    if (inv.amountSettledInr != null) {
      totalCollectedInr += inv.amountSettledInr;
    } else {
      totalCollectedInr += snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
    }
  }
  for (const c of manualCareer) {
    if (c.amountSettledInr != null) {
      totalCollectedInr += c.amountSettledInr;
    } else {
      totalCollectedInr += await amountToInr(c.amountPaid, c.currency ?? 'INR');
    }
  }
  for (const r of manualRn) {
    if (r.amountSettledInr != null) {
      totalCollectedInr += r.amountSettledInr;
    } else {
      totalCollectedInr += await amountToInr(r.amountPaid, r.currency ?? 'INR');
    }
  }

  // ── 5. Collections This Month ────────────────────────────────────────────────
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
  for (const c of manualCareer) {
    const d = new Date(c.createdAt);
    if (d >= monthStart && d <= monthEnd) {
      if (c.amountSettledInr != null) {
        monthCollectedInr += c.amountSettledInr;
      } else {
        monthCollectedInr += await amountToInr(c.amountPaid, c.currency ?? 'INR');
      }
    }
  }
  for (const r of manualRn) {
    const d = new Date(r.createdAt);
    if (d >= monthStart && d <= monthEnd) {
      if (r.amountSettledInr != null) {
        monthCollectedInr += r.amountSettledInr;
      } else {
        monthCollectedInr += await amountToInr(r.amountPaid, r.currency ?? 'INR');
      }
    }
  }

  // ── 6. Pending Receivables ───────────────────────────────────────────────────
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

  // ── 7. Settlement Fee Leakage (Across Invoices + Manual Clients) ──────────────
  // Real money deducted by payment gateways (positive gaps only).
  let totalLeakageInr = 0;
  for (const inv of paidInvoices) {
    if (inv.amountSettledInr != null) {
      const netInr = snapshotToInr(inv.subtotalConverted, inv.currency, inv.exchangeRate);
      const gap = netInr - inv.amountSettledInr;
      if (gap > 0) totalLeakageInr += gap;
    }
  }
  for (const c of manualCareer) {
    if (c.amountSettledInr != null) {
      const netExpected = await amountToInr(c.amountPaid, c.currency ?? 'INR');
      const gap = netExpected - c.amountSettledInr;
      if (gap > 0) totalLeakageInr += gap;
    }
  }
  for (const r of manualRn) {
    if (r.amountSettledInr != null) {
      const netExpected = await amountToInr(r.amountPaid, r.currency ?? 'INR');
      const gap = netExpected - r.amountSettledInr;
      if (gap > 0) totalLeakageInr += gap;
    }
  }

  // ── 8. Recent Invoices (last 6, all statuses) ────────────────────────────────
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
