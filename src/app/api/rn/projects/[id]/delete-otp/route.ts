// src/app/api/rn/projects/[id]/delete-otp/route.ts
// Two-step, OTP-guarded client deletion (destructive — cascades the client's
// projects, milestones, messages, deliverables, and logs):
//   POST   — email a 6-digit OTP to the ADMIN inbox (not the client)
//   DELETE — verify the OTP (?otp=123456) and permanently delete the client

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { logAudit } from '@/lib/audit/logger';

const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

const ADMIN_EMAIL = process.env.RN_ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_NOTIFY_EMAIL ?? 'info@theripplenexus.com';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, companyName: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.rnDeleteOtp.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, otpHash: hashOtp(otp), expiresAt },
    update: { otpHash: hashOtp(otp), expiresAt },
  });

  // The OTP goes to the ADMIN inbox — deleting a client must never notify them.
  const { sendRnEmail, tplGeneric } = await import('@/lib/rn/mailer');
  const result = await sendRnEmail({
    clientId: client.id,
    to: ADMIN_EMAIL,
    subject: `Deletion OTP for ${client.companyName || client.name}`,
    trigger: 'delete_otp',
    sentBy: session.adminId,
    html: tplGeneric(
      `Deletion OTP for ${client.companyName || client.name}`,
      'Confirm client deletion',
      `You requested deletion of ${client.companyName || client.name}.`,
      'Confirm Deletion',
      [
        `You requested deletion of ${client.companyName || client.name} (${client.email}) and all of their project data.`,
        `Your OTP is: ${otp}`,
        `This code expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, no action is needed — nothing is deleted without the code.`
      ]
    ).html,
  });

  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Could not send OTP email' }, { status: 502 });
  return NextResponse.json({ ok: true, message: 'OTP sent to the admin inbox' });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const otp = new URL(req.url).searchParams.get('otp') ?? '';
  if (!/^\d{6}$/.test(otp)) return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });

  const record = await db.rnDeleteOtp.findUnique({ where: { clientId: params.id } });
  if (!record) return NextResponse.json({ error: 'No deletion request found — request an OTP first' }, { status: 400 });
  if (record.expiresAt.getTime() < Date.now()) {
    await db.rnDeleteOtp.delete({ where: { clientId: params.id } }).catch(() => {});
    return NextResponse.json({ error: 'OTP expired — request a new one' }, { status: 400 });
  }

  const attempt = Buffer.from(hashOtp(otp), 'utf8');
  const stored = Buffer.from(record.otpHash, 'utf8');
  if (attempt.length !== stored.length || !crypto.timingSafeEqual(attempt, stored)) {
    return NextResponse.json({ error: 'Incorrect OTP' }, { status: 400 });
  }

  const client = await db.rnClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, companyName: true, amountPaid: true, currency: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  await logAudit(
    { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
    'CLIENT_DELETED',
    'RnClient',
    client.id,
    { before: client }
  );

  // Cascades: milestones, tasks, messages, deliverables, revisions,
  // activity/email logs, read state, OTPs — all FK'd with onDelete: Cascade.
  await db.rnClient.delete({ where: { id: client.id } });

  return NextResponse.json({ ok: true });
}
