// src/app/api/rn/projects/[id]/milestones/route.ts
// GET  — list a project's milestones (with tasks)
// POST — create a milestone (optionally payment-bearing via amount > 0)

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const milestones = await db.rnProjectMilestone.findMany({
    where: { clientId: params.id },
    orderBy: { order: 'asc' },
    include: { tasks: { orderBy: { createdAt: 'asc' } } },
  });
  return NextResponse.json({ milestones });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? '').toString().trim();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const client = await db.rnClient.findUnique({ where: { id: params.id }, select: { id: true, currency: true } });
  if (!client) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const amount = Math.max(0, Number(body?.amount) || 0);
  const last = await db.rnProjectMilestone.findFirst({
    where: { clientId: client.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const milestone = await db.rnProjectMilestone.create({
    data: {
      clientId: client.id,
      title: title.slice(0, 200),
      description: typeof body?.description === 'string' ? body.description.slice(0, 2000) : null,
      dueDate: body?.dueDate ? new Date(body.dueDate) : null,
      order: (last?.order ?? 0) + 1,
      amount,
      currency: typeof body?.currency === 'string' && body.currency ? body.currency : client.currency,
      paymentStatus: amount > 0 ? 'UNPAID' : 'NOT_APPLICABLE',
    },
  });

  await db.rnActivityLog.create({
    data: { clientId: client.id, action: `added milestone "${milestone.title}"`, performedBy: 'Admin' },
  }).catch(() => {});

  return NextResponse.json({ milestone }, { status: 201 });
}
