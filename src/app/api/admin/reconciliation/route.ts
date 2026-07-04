// src/app/api/admin/reconciliation/route.ts
// READ-ONLY invoice reconciliation. Flags internal inconsistencies (money drift,
// corrupted line items, installment/total mismatches, bad status). It performs
// NO writes — safe to run against production. This is the cheap, low-risk
// alternative to the Float->Decimal migration (audit item #7): if this stays
// quiet, the floating-point drift risk is theoretical for your data.
//
// Usage (while logged in as an admin): GET /api/admin/reconciliation
//   ?limit=5000   cap rows scanned (default 5000, max 20000)
//   ?status=PAID  only this invoice status
//   ?brandId=catalyst | ripple_nexus
//   ?all=1        include clean invoices in the response too

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { reconcileInvoice, problemType, type ReconInvoice } from '@/lib/reconciliation';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 5000, 1), 20000);
  const statusFilter = sp.get('status') || undefined;
  const brandFilter = sp.get('brandId') || undefined;
  const includeClean = sp.get('all') === '1';

  const invoices = (await db.invoice.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(brandFilter ? { brandId: brandFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, invoiceNumber: true, status: true, currency: true, brandId: true,
      createdAt: true, lineItems: true, installments: true, installmentPlan: true,
      discountAmount: true, taxAmount: true, subtotalConverted: true,
      processingFeeConverted: true, totalPayable: true, paidAt: true,
    },
  })) as ReconInvoice[];

  const byType: Record<string, number> = {};
  const issues = [];
  for (const inv of invoices) {
    const problems = reconcileInvoice(inv);
    for (const p of problems) {
      const key = problemType(p);
      byType[key] = (byType[key] ?? 0) + 1;
    }
    if (problems.length > 0 || includeClean) {
      issues.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        brandId: inv.brandId,
        totalPayable: inv.totalPayable,
        createdAt: inv.createdAt,
        problems,
      });
    }
  }

  const flagged = issues.filter(i => i.problems.length > 0).length;

  return NextResponse.json({
    ok: flagged === 0,
    scanned: invoices.length,
    flagged,
    tolerance: 'zero-decimal currencies: 1 unit; others: 0.02',
    byType,
    issues,
    generatedAt: new Date().toISOString(),
  });
}
