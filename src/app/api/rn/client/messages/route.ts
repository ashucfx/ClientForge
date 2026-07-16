// src/app/api/rn/client/messages/route.ts
// B2B client portal: send a message to the Ripple Nexus team.
// Authenticated by the rn_client_session cookie (OTP login), same as
// feedback/review/bug-report. Notifies all RN admins and starts the SLA clock.

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { recordMessageSent } from '@/lib/communications';
import { notifyAllAdmins } from '@/lib/notifications';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let content: string;
  try {
    const body = await req.json();
    content = (body?.content ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });

  const client = await db.rnClient.findUnique({
    where: { id: session.clientId },
    select: { id: true, name: true, companyName: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const message = await db.rnMessage.create({
    data: {
      clientId: client.id,
      content,
      authorType: 'client',
      authorName: client.name,
      readByClient: true,
    },
  });

  await recordMessageSent(client.id, 'RN', 'client', 'NEW_MESSAGE');

  await db.rnActivityLog.create({
    data: {
      clientId: client.id,
      action: 'sent a message',
      performedBy: client.name,
    },
  }).catch(() => {});

  await notifyAllAdmins({
    title: `💬 New message from ${client.companyName || client.name}`,
    message: content.slice(0, 140),
    type: 'INFO',
    link: `/rn/inbox?client=${client.id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
