// src/app/api/career/admin/clients/[id]/comments/route.ts
// Admin: GET full comment thread (marks client msgs read), POST reply to client

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { waitUntil } from '@vercel/functions';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

interface Attachment { name: string; url: string; mimeType: string; size: number; }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();

  // Mark all client comments as read by admin — clears the unread badge
  await db.careerComment.updateMany({
    where: { clientId: params.id, authorType: 'client', readByAdmin: false },
    data:  { readByAdmin: true, readByAdminAt: now },
  });

  const comments = await db.careerComment.findMany({
    where:   { clientId: params.id },
    orderBy: { createdAt: 'asc' },
  });

  // Count unread admin messages (client hasn't read yet)
  const unreadForClient = comments.filter(c => c.authorType === 'admin' && !c.readByClient).length;

  return NextResponse.json({ comments, unreadForClient });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body        = await req.json().catch(() => null);
  const content     = (body?.content as string | undefined)?.trim();
  const attachments = (body?.attachments as Attachment[] | undefined) ?? [];
  const isInternal  = body?.isInternalOnly === true;

  if (!content && attachments.length === 0) {
    return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  }
  if (content && content.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars).' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const comment = await db.careerComment.create({
    data: {
      clientId:      params.id,
      authorType:    'admin',
      authorName:    'Catalyst Team',
      content:       content ?? '',
      attachments:   attachments.length > 0 ? (attachments as object[]) : undefined,
      isInternalOnly: isInternal,
      readByAdmin:   true,
      readByAdminAt: new Date(),
    },
  });

  // Fire-and-forget: email client (don't block UI response)
  // Only email if this is not an internal note
  if (!isInternal) {
    waitUntil(
      sendCareerEmail({
        to:       client.email,
        trigger:  'MESSAGE_NOTIFY',
        clientId: client.id,
        data:     { recipientName: client.name, senderType: 'admin', portalUrl: `${PORTAL_URL}/portal/dashboard` },
      }).catch(console.error)
    );
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}

