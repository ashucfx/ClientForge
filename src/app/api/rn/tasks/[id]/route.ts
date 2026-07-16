// src/app/api/rn/tasks/[id]/route.ts
// PATCH — toggle/rename a milestone task · DELETE — remove it

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const data: Record<string, any> = {};
  if (typeof body?.isCompleted === 'boolean') data.isCompleted = body.isCompleted;
  if (typeof body?.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 300);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const task = await db.rnProjectTask.update({ where: { id: params.id }, data }).catch(() => null);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const task = await db.rnProjectTask.delete({ where: { id: params.id } }).catch(() => null);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
