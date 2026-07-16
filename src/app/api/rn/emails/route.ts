// src/app/api/rn/emails/route.ts
// GET  — email log with filters (?status=&trigger=&clientId=&q=)
// POST — manual compose: send a branded email to a client over SMTP

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { sendRnEmail, rnEmailShell } from '@/lib/rn/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const trigger = searchParams.get('trigger');
  const clientId = searchParams.get('clientId');

  const logs = await db.rnEmailLog.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(trigger ? { trigger } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { client: { select: { id: true, name: true, companyName: true, email: true } } },
    orderBy: { sentAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = (body?.clientId ?? '').toString();
  const subject = (body?.subject ?? '').toString().trim();
  const message = (body?.message ?? '').toString().trim();

  if (!clientId || !subject || !message) {
    return NextResponse.json({ error: 'clientId, subject, and message are required' }, { status: 400 });
  }
  if (subject.length > 200) return NextResponse.json({ error: 'Subject too long' }, { status: 400 });
  if (message.length > 10000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const client = await db.rnClient.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const paragraphs = message
    .split(/\n{2,}/)
    .map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const result = await sendRnEmail({
    clientId: client.id,
    to: client.email,
    subject,
    html: rnEmailShell(subject, `<p>Hi ${client.name},</p>${paragraphs}`),
    trigger: 'manual',
    sentBy: session.adminId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
