// src/app/api/rn/retainers/[id]/route.ts
// GET    — get single retainer
// PATCH  — update (status, amount, notes, gateway, nextBillingAt, autoRenew)
// DELETE — soft-cancel the retainer

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const retainer = await prisma.rnRetainer.findUnique({
    where: { id: params.id },
    include: { client: { select: { id: true, name: true, companyName: true, email: true, country: true } } },
  });
  if (!retainer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ retainer });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const allowed = ['status', 'amount', 'currency', 'notes', 'paymentGateway', 'nextBillingAt', 'lastBilledAt', 'autoRenew', 'billingDay', 'name', 'type'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if ('amount' in updates) updates.amount = Number(updates.amount);
  if ('billingDay' in updates) updates.billingDay = Number(updates.billingDay);
  if ('nextBillingAt' in updates) updates.nextBillingAt = new Date(updates.nextBillingAt as string);
  if ('lastBilledAt' in updates && updates.lastBilledAt) updates.lastBilledAt = new Date(updates.lastBilledAt as string);

  const retainer = await prisma.rnRetainer.update({
    where: { id: params.id },
    data: updates,
    include: { client: { select: { name: true, companyName: true } } },
  });
  return NextResponse.json({ retainer });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await prisma.rnRetainer.update({
    where: { id: params.id },
    data: { status: 'CANCELLED' },
  });
  return NextResponse.json({ ok: true });
}
