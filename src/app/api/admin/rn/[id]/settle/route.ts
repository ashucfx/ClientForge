// src/app/api/admin/rn/[id]/settle/route.ts
// PATCH — Set settlement data on a manual RN client record.

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

  if (body.amountSettledInr !== undefined && body.amountSettledInr !== null) {
    if (typeof body.amountSettledInr !== 'number' || body.amountSettledInr < 0) {
      return NextResponse.json({ error: 'amountSettledInr must be a non-negative number' }, { status: 400 });
    }
  }

  const client = await db.rnClient.findUnique({
    where: { id },
    select: { id: true, amountPaid: true, currency: true },
  });
  if (!client) return NextResponse.json({ error: 'RN client not found' }, { status: 404 });

  const updated = await db.rnClient.update({
    where: { id },
    data: {
      amountSettledInr: body.amountSettledInr ?? null,
      settlementNote: body.settlementNote ?? null,
      settledAt: body.settledAt ? new Date(body.settledAt) : null,
    },
    select: {
      id: true,
      name: true,
      amountSettledInr: true,
      settlementNote: true,
      settledAt: true,
      amountPaid: true,
      currency: true,
    },
  });

  return NextResponse.json({ ok: true, client: updated });
}
