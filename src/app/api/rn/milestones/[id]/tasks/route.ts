// src/app/api/rn/milestones/[id]/tasks/route.ts
// POST — add a task to a milestone

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? '').toString().trim();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const milestone = await db.rnProjectMilestone.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

  const task = await db.rnProjectTask.create({
    data: { milestoneId: milestone.id, title: title.slice(0, 300) },
  });
  return NextResponse.json({ task }, { status: 201 });
}
