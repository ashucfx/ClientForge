// src/app/api/career/admin/clients/[id]/comments/route.ts
// Admin can view all comments and post admin replies

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comments = await db.careerComment.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = (body?.content as string | undefined)?.trim();

  if (!content || content.length < 2) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const comment = await db.careerComment.create({
    data: {
      clientId: params.id,
      authorType: 'admin',
      authorName: 'Ripple Nexus Team',
      content,
    },
  });

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
