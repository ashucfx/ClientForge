import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = cookies().get('rn_client_session')?.value ?? '';
  const payload = await verifyRnClientSession(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.rnClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { description, url } = body;
  if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 });

  // BugReport.clientId is a FK to CareerClient — we can't use it for RN.
  // Store RN client identity in clientName, clientEmail, and adminNotes (JSON context).
  const bugReport = await db.bugReport.create({
    data: {
      clientId:    null, // not a CareerClient
      clientName:  client.name,
      clientEmail: client.email,
      description,
      url: url || undefined,
      status: 'OPEN',
      adminNotes:  JSON.stringify({ source: 'RN_PORTAL', rnClientId: client.id }),
    },
  });

  return NextResponse.json({ success: true, id: bugReport.id });
}
