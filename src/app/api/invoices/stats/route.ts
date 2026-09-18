// src/app/api/invoices/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [total, paid, pending, expired] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: 'PAID' } }),
    prisma.invoice.count({ where: { status: 'PENDING' } }),
    prisma.invoice.count({ where: { status: 'EXPIRED' } }),
  ]);

  // Revenue grouped by currency (paid invoices only).
  // Uses subtotalConverted = net revenue Catalyst retains (after gateway fee absorbed by client).
  // totalPayable is the gross billed amount; subtotalConverted is what Catalyst actually pockets.
  const paidInvoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    select: { currency: true, totalPayable: true, subtotalConverted: true, currencySymbol: true },
  });

  const revenue: Record<string, { amount: number; grossAmount: number; symbol: string }> = {};
  for (const inv of paidInvoices) {
    if (!revenue[inv.currency]) {
      revenue[inv.currency] = { amount: 0, grossAmount: 0, symbol: inv.currencySymbol };
    }
    // net = what Catalyst retains; gross = what client was billed
    revenue[inv.currency].amount += inv.subtotalConverted;
    revenue[inv.currency].grossAmount += inv.totalPayable;
  }

  // Client type breakdown
  const typeBreakdown = await prisma.invoice.groupBy({
    by: ['clientType'],
    _count: { _all: true },
  });

  return NextResponse.json({
    total,
    paid,
    pending,
    expired,
    revenue,
    typeBreakdown: typeBreakdown.map(t => ({
      type: t.clientType,
      count: t._count._all,
    })),
  });
}
