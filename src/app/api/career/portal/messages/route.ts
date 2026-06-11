// src/app/api/career/portal/messages/route.ts
// Client portal: GET thread, POST send message

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { notifyAllAdmins } from '@/lib/notifications';
import { recordMessageSent, markConversationReadByClient } from '@/lib/communications';
import { waitUntil } from '@vercel/functions';


const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const messages = await db.careerMessage.findMany({
    where: { clientId: payload.clientId },
    orderBy: { createdAt: 'asc' },
  });

  // Mark admin messages as read by client and update read state
  await markConversationReadByClient(payload.clientId, 'CAREER');

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = body?.content ? String(body.content).trim() : '';
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const message = await db.careerMessage.create({
    data: {
      clientId: client.id,
      authorType: 'client',
      authorName: client.name,
      content,
      readByClient: true,
    },
  });

  await recordMessageSent(client.id, 'CAREER', 'client', 'NEW_MESSAGE');

  const adminPortalUrl = `${PORTAL_URL}/career/${client.id}`;

  // In-app notification (DB) — always fires, no debounce needed
  waitUntil(
    notifyAllAdmins({
      title: `New message from ${client.name}`,
      message: content.slice(0, 120) + (content.length > 120 ? '…' : ''),
      type: 'INFO',
      link: adminPortalUrl,
    }).catch(console.error)
  );

  // Email notification to admin with 5-minute debounce
  waitUntil((async () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEmail = await db.careerEmailLog.findFirst({
      where: {
        clientId: client.id,
        trigger: 'MESSAGE_NOTIFY',
        sentAt: { gte: fiveMinsAgo },
      },
    });

    if (!recentEmail) {
      await sendCareerEmail({
        to: ADMIN_EMAIL,
        replyTo: client.email,
        trigger: 'MESSAGE_NOTIFY',
        clientId: client.id,
        data: { recipientName: 'Catalyst Team', senderType: 'client', portalUrl: adminPortalUrl },
      }).catch(console.error);
    }
  })());

  return NextResponse.json({ message }, { status: 201 });
}
