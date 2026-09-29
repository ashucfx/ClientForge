// src/app/api/career/portal/agreement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import {
  CURRENT_SLA_VERSION,
  SLA_AGREEMENT_SECTIONS,
  computeAgreementChecksum,
} from '@/lib/agreements/slaTerms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const slaLog = await db.careerActivityLog.findFirst({
    where: { clientId: client.id, action: 'sla_agreement_accepted' },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    version: CURRENT_SLA_VERSION,
    sections: SLA_AGREEMENT_SECTIONS,
    isAccepted: Boolean(slaLog),
    acceptedAt: slaLog?.createdAt ?? null,
    acceptanceMetadata: slaLog?.metadata ?? null,
    clientName: client.name,
    clientEmail: client.email,
  });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body.accepted) {
    return NextResponse.json({ error: 'Agreement acceptance confirmation is required' }, { status: 400 });
  }

  // Extract client network metadata
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  const timestamp = new Date().toISOString();

  const checksum = computeAgreementChecksum({
    email: client.email,
    version: CURRENT_SLA_VERSION,
    timestamp,
    ipAddress,
  });

  // Store in CareerActivityLog (audit-grade tamper-proof entry)
  const activityLog = await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'sla_agreement_accepted',
      performedBy: 'client',
      metadata: {
        version: CURRENT_SLA_VERSION,
        agreementType: 'MASTER_SERVICES_SLA',
        ipAddress,
        userAgent,
        acceptedAt: timestamp,
        checksum,
        clientName: client.name,
        clientEmail: client.email,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    acceptedAt: timestamp,
    version: CURRENT_SLA_VERSION,
    checksum,
    logId: activityLog.id,
  });
}
