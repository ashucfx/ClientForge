// src/app/api/career/portal/comments/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { waitUntil } from '@vercel/functions';


const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

interface Attachment { name: string; url: string; mimeType: string; size: number; }

async function getClient() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  const client = await db.careerClient.findUnique({
    where:  { id: payload.clientId },
    select: { id: true, name: true, email: true },
  });
  return client ?? null;
}

export async function GET() {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();

  // Mark all admin messages as read by client
  await db.careerComment.updateMany({
    where: { clientId: client.id, authorType: 'admin', readByClient: false },
    data:  { readByClient: true, readByClientAt: now },
  });

  const comments = await db.careerComment.findMany({
    where:   { clientId: client.id, isInternalOnly: false },
    orderBy: { createdAt: 'asc' },
  });

  // Count unread client messages (admin hasn't read yet)
  const unreadForAdmin = comments.filter(c => c.authorType === 'client' && !c.readByAdmin).length;

  return NextResponse.json({ comments, unreadForAdmin });
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content     = (body?.content as string | undefined)?.trim();
  const attachments = (body?.attachments as Attachment[] | undefined) ?? [];
  const annotationX = body?.annotationX as number | undefined;
  const annotationY = body?.annotationY as number | undefined;

  if (!content && attachments.length === 0) {
    return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  }
  if (content && content.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars).' }, { status: 400 });
  }

  const comment = await db.careerComment.create({
    data: {
      clientId:      client.id,
      authorType:    'client',
      authorName:    client.name,
      content:       content ?? '',
      attachments:   attachments.length > 0 ? (attachments as object[]) : undefined,
      annotationX,
      annotationY,
      readByClient:  true,
      readByClientAt: new Date(),
    },
  });

  waitUntil(
    sendCareerEmail({
      to:      ADMIN_EMAIL,
      trigger: 'MESSAGE_NOTIFY',
      data: {
        recipientName: 'Catalyst Team',
        senderType:    'client',
        portalUrl:     `${PORTAL_URL}/career/${client.id}`,
        body:          `${client.name} sent a new message. Open the admin panel to view and reply.`,
      },
    }).catch(console.error)
  );

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
