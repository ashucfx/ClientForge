// src/app/api/admin/invoices/[id]/settle/route.ts
// PATCH — Set settlement reconciliation data on a PAID invoice.
// Body: { amountSettledInr: number, settlementNote?: string, settledAt?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const body = await req.json() as {
    amountSettledInr?: number | null;
    settlementNote?: string | null;
    settledAt?: string | null;
  };

  // Validate
  if (body.amountSettledInr !== undefined && body.amountSettledInr !== null) {
    if (typeof body.amountSettledInr !== 'number' || body.amountSettledInr < 0) {
      return NextResponse.json({ error: 'amountSettledInr must be a non-negative number' }, { status: 400 });
    }
  }

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, totalPayable: true, subtotalConverted: true, currency: true },
  });

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const updated = await db.invoice.update({
    where: { id },
    data: {
      amountSettledInr: body.amountSettledInr ?? null,
      settlementNote: body.settlementNote ?? null,
      settledAt: body.settledAt ? new Date(body.settledAt) : null,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      invoiceNumber: true,
      amountSettledInr: true,
      settlementNote: true,
      settledAt: true,
      subtotalConverted: true,
      totalPayable: true,
      currency: true,
    },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}
