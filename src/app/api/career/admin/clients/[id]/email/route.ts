// src/app/api/career/admin/clients/[id]/email/route.ts
// Manual email trigger by admin

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { EmailTrigger } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
const VALID_TRIGGERS: EmailTrigger[] = [
  'WELCOME', 'FORM_CONFIRM', 'DRAFT_READY', 'REVISION', 'FINAL_DELIVERY', 'LINKEDIN_SECURITY',
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const trigger = body?.trigger as EmailTrigger | undefined;

  if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    include: { deliverables: { select: { label: true, fileUrl: true } } },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  let portalUrl = `${PORTAL_URL}/portal/dashboard`;

  // Regenerate magic token for WELCOME re-send
  if (trigger === 'WELCOME') {
    const magicToken  = generateMagicToken();
    const tokenExpiry = magicTokenExpiry();
    await db.careerClient.update({
      where: { id: client.id },
      data: { magicToken, magicTokenExpiry: tokenExpiry },
    });
    portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;
  }

  const resendId = await sendCareerEmail({
    to: client.email,
    trigger,
    data: {
      name: client.name,
      packageLabel: PACKAGE_LABELS[client.packageType],
      portalUrl,
      files: client.deliverables,
    },
  });

  await db.careerEmailLog.create({
    data: {
      clientId: client.id,
      trigger,
      resendId,
      status: 'sent',
      metadata: { manual: true },
    },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'email_sent_manual',
      performedBy: 'admin',
      metadata: { trigger },
    },
  });

  return NextResponse.json({ ok: true, resendId });
}
