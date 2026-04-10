// src/app/api/career/portal/comments/route.ts
// Client can POST a comment and GET all comments for their account

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

async function getClient() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true },
  });
  return client ?? null;
}

export async function GET() {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comments = await db.careerComment.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = (body?.content as string | undefined)?.trim();
  if (!content || content.length < 2) {
    return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Comment too long (max 1000 chars).' }, { status: 400 });
  }

  const comment = await db.careerComment.create({
    data: {
      clientId: client.id,
      authorType: 'client',
      authorName: client.name,
      content,
    },
  });

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
