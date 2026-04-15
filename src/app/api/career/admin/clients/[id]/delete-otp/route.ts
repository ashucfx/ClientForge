// src/app/api/career/admin/clients/[id]/delete-otp/route.ts
// POST — send OTP to client email before delete
// DELETE — verify OTP and delete client

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';

const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'info@theripplenexus.com';

// POST /api/career/admin/clients/[id]/delete-otp
// Sends a 6-digit OTP to the ADMIN email for confirmation
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const otp       = generateOtp();
  const otpHash   = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.careerDeleteOtp.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, otpHash, expiresAt },
    update: { otpHash, expiresAt },
  });

  // OTP goes to admin inbox, not the client being deleted
  await sendCareerEmail({
    to: ADMIN_EMAIL,
    trigger: 'DELETE_OTP',
    data: { clientName: client.name, clientEmail: client.email, otp, expiresMinutes: OTP_TTL_MINUTES },
  });

  return NextResponse.json({ ok: true, message: `OTP sent to admin email` });
}

// DELETE /api/career/admin/clients/[id]/delete-otp?otp=123456
// Validates OTP and permanently deletes the client
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const otp = req.nextUrl.searchParams.get('otp');
  if (!otp) return NextResponse.json({ error: 'otp required' }, { status: 400 });

  const record = await db.careerDeleteOtp.findUnique({ where: { clientId: params.id } });
  if (!record) {
    return NextResponse.json({ error: 'No OTP found — request one first' }, { status: 400 });
  }

  if (new Date() > record.expiresAt) {
    await db.careerDeleteOtp.delete({ where: { clientId: params.id } });
    return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
  }

  const inputHash = hashOtp(otp.trim());
  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(record.otpHash));
  } catch {
    match = false;
  }

  if (!match) {
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
  }

  // OTP valid — delete client (cascades to all related records)
  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { name: true, email: true },
  });

  await db.careerClient.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true, deleted: { name: client?.name } });
}
