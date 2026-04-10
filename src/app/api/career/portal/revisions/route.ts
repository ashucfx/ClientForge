// src/app/api/career/portal/revisions/route.ts
// Client can GET their revision requests and POST a new revision request

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

  return NextResponse.json({ ok: true, revision }, { status: 201 });
}
