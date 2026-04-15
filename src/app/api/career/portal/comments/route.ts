// src/app/api/career/portal/comments/route.ts
// Client can POST a comment and GET all comments for their account

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'info@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

async function getClient() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true },
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

  // Email notification to admin at info@theripplenexus.com
  sendCareerEmail({
    to: ADMIN_EMAIL,
    trigger: 'MESSAGE_NOTIFY',
    data: {
      recipientName: 'Ripple Nexus Team',
      senderType: 'client',
      portalUrl: `${PORTAL_URL}/career/${client.id}`,
      body: `${client.name} has sent a new message in the comments section. Log in to the admin panel to view and reply.`,
    },
  }).catch(console.error);

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
