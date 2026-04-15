// src/app/api/career/portal/revisions/route.ts
// Client can GET their revision requests and POST a new revision request

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

  const revisions = await db.careerRevision.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const note      = (body?.note as string | undefined)?.trim();
  const fileLabel = (body?.fileLabel as string | undefined)?.trim() || undefined;

  if (!note || note.length < 5) {
    return NextResponse.json({ error: 'Please describe the revision needed (min 5 chars).' }, { status: 400 });
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Note too long (max 2000 chars).' }, { status: 400 });
  }

  // Enforce max 2 revision requests per client
  const existingCount = await db.careerRevision.count({
    where: { clientId: client.id, requestedBy: 'client' },
  });
  if (existingCount >= 2) {
    return NextResponse.json(
      { error: 'You have reached the maximum of 2 revision requests. Please contact support for further assistance.' },
      { status: 403 },
    );
  }

  const revision = await db.careerRevision.create({
    data: {
      clientId: client.id,
      requestedBy: 'client',
      note,
      fileLabel,
      status: 'PENDING',
    },
  });

  // Log activity
  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'revision_requested',
      performedBy: 'client',
      metadata: { note: note.slice(0, 100), fileLabel },
    },
  });

  // Notify admin that a revision has been requested
  const fileContext = fileLabel ? ` regarding "${fileLabel}"` : '';
  sendCareerEmail({
    to: ADMIN_EMAIL,
    trigger: 'MESSAGE_NOTIFY',
    data: {
      recipientName: 'Ripple Nexus Team',
      senderType: 'client',
      portalUrl: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
      subject: `Ripple Nexus — ${client.name} has requested a revision`,
      body: `${client.name} has submitted a new revision request${fileContext}. Log in to the admin panel to review and approve or deny it.\n\nRequest: "${note.slice(0, 200)}${note.length > 200 ? '…' : ''}"`,
    },
  }).catch(console.error);

  return NextResponse.json({ ok: true, revision }, { status: 201 });
}
