// src/app/api/rn/retainers/route.ts
// GET  — list retainers (optional ?clientId=, ?status=)
// POST — create a new retainer

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId') ?? undefined;
  const status   = searchParams.get('status') ?? undefined;

  const retainers = await prisma.rnRetainer.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(status   ? { status }   : {}),
    },
    include: {
      client: {
        select: { id: true, name: true, companyName: true, email: true, country: true, currency: true },
      },
    },
    orderBy: { nextBillingAt: 'asc' },
  });

  return NextResponse.json({ retainers });
}

export async function POST(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);

  const { clientId, name, type, amount, currency, billingDay, nextBillingAt, autoRenew, notes, paymentGateway } = body ?? {};

  if (!clientId || !name || !amount || !nextBillingAt) {
    return NextResponse.json({ error: 'clientId, name, amount, and nextBillingAt are required' }, { status: 400 });
  }

  // Validate client exists
  const client = await prisma.rnClient.findUnique({ where: { id: clientId }, select: { id: true, country: true } });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Auto-detect gateway based on country (can be overridden)
  const detectedGateway = client.country?.toLowerCase() === 'india' || client.country?.toLowerCase() === 'in'
    ? 'RAZORPAY' : 'PAYPAL';
  const gateway = paymentGateway ?? detectedGateway;

  const retainer = await prisma.rnRetainer.create({
    data: {
      clientId,
      name: name.toString().trim().slice(0, 200),
      type: type ?? 'MONTHLY',
      amount: Number(amount),
      currency: currency ?? 'INR',
      billingDay: Number(billingDay ?? 1),
      nextBillingAt: new Date(nextBillingAt),
      autoRenew: autoRenew !== false,
      notes: notes?.toString().trim() ?? null,
      paymentGateway: gateway,
    },
    include: { client: { select: { name: true, companyName: true } } },
  });

  return NextResponse.json({ retainer }, { status: 201 });
}
