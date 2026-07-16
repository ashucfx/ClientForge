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
    where: { clientId: params.id, isInternalOnly: false },
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
  try {
    const body = await req.json();
    content = (body?.content ?? '').toString().trim();
    internal = body?.internal === true;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true },
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

  // Fire-and-forget: email client + log activity
  waitUntil((async () => {
    try {
      const { Resend } = await import('resend');
      const { getBrand } = await import('@/lib/brand/registry');
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const brand = getBrand('ripple_nexus');
      const portalUrl = `${PORTAL_URL}/rn/portal/dashboard`;

      await resend.emails.send({
        from: `${brand.name} <${brand.fromEmail}>`,
        reply_to: brand.replyTo,
        to: client.email,
        subject: `New message from the ${brand.name} team`,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#333;line-height:1.6;max-width:600px;margin:0 auto">
          <h2>Hi ${client.name},</h2>
          <p>You have a new message from the ${brand.name} team on your project portal.</p>
          <div style="margin:24px 0">
            <a href="${portalUrl}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">
              View Message
            </a>
          </div>
          <p style="color:#666;font-size:13px">Log in to reply and stay up to date with your project.</p>
        </div>`,
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
