// src/app/api/rn/projects/[id]/messages/route.ts
// Admin: GET all messages (marks client msgs read), POST send message to client

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { prisma as db } from '@/lib/db';
import { notifyAllAdmins } from '@/lib/notifications';
import { recordMessageSent, markConversationReadByAdmin } from '@/lib/communications';
import { waitUntil } from '@vercel/functions';

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'team@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://theripplenexus.com');

/** GET — fetch full message thread, mark client messages as read by admin */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const messages = await db.rnMessage.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'asc' },
  });

  // Mark all client messages as read by admin and update read state
  await markConversationReadByAdmin(params.id, 'RN');

  return NextResponse.json({ messages });
}

/** POST — admin sends a message to the client */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  let content: string;
  let internal = false;
  let isPriority = false;
  let isPinned = false;
  let replyToId: string | undefined;
  let attachments: any[] | undefined;

  try {
    const body = await req.json();
    content = (body?.content ?? '').toString().trim();
    internal = body?.internal === true;
    isPriority = body?.isPriority === true;
    isPinned = body?.isPinned === true;
    replyToId = body?.replyToId;
    attachments = body?.attachments;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  if (content.length > 8000) return NextResponse.json({ error: 'Message too long (max 8000 chars)' }, { status: 400 });

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, magicToken: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const message = await db.rnMessage.create({
    data: {
      clientId: client.id,
      content,
      authorType: 'admin',
      authorName: internal ? 'Internal Note' : 'Ripple Nexus Team',
      readByAdmin: true,
      isInternalOnly: internal,
      isPriority,
      isPinned,
      replyToId,
      attachments: attachments ? (attachments as any) : undefined,
    },
  });

  if (!internal) {
    await recordMessageSent(client.id, 'RN', 'admin', undefined);
  }

  // Internal notes never reach the client — skip email + client-facing side effects
  if (internal) {
    await db.rnActivityLog.create({
      data: {
        clientId: client.id,
        action: 'added an internal note',
        performedBy: session.adminId,
      },
    }).catch(() => {});
    return NextResponse.json({ message }, { status: 201 });
  }

  // Fire-and-forget: email client over RN SMTP + log activity
  waitUntil((async () => {
    try {
      const { sendRnEmail, tplNewMessage, portalUrlFor } = await import('@/lib/rn/mailer');
      const { subject, html } = tplNewMessage(client.name, portalUrlFor(client.magicToken));
      await sendRnEmail({
        clientId: client.id,
        to: client.email,
        subject,
        html,
        trigger: 'admin_message',
        sentBy: session.adminId,
      });
    } catch (err) {
      console.error('[RN messages POST] Client email failed:', err);
    }

    await db.rnActivityLog.create({
      data: {
        clientId: client.id,
        action: 'admin_message_sent',
        performedBy: session.adminId,
        metadata: { preview: content.slice(0, 100) },
      },
    });
  })());

  return NextResponse.json({ success: true, message }, { status: 201 });
}
