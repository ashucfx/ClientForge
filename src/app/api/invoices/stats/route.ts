// src/app/api/invoices/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const [total, paid, pending, expired] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: 'PAID' } }),
    prisma.invoice.count({ where: { status: 'PENDING' } }),
    prisma.invoice.count({ where: { status: 'EXPIRED' } }),
  ]);

  // Revenue grouped by currency (paid invoices only)
  const paidInvoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    select: { currency: true, totalPayable: true, currencySymbol: true },
  });

  const revenue: Record<string, { amount: number; symbol: string }> = {};
  for (const inv of paidInvoices) {
    if (!revenue[inv.currency]) {
      revenue[inv.currency] = { amount: 0, symbol: inv.currencySymbol };
    }
    revenue[inv.currency].amount += inv.totalPayable;
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
