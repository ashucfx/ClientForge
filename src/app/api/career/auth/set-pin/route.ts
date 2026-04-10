// src/app/api/career/auth/set-pin/route.ts
// Client sets/updates their 6-digit PIN (requires active portal session)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyPortalToken } from '@/lib/career/auth';
import { prisma as db } from '@/lib/db';
import { createHmac } from 'crypto';

function hashPin(pin: string): string {
  const secret = process.env.CAREER_PORTAL_SECRET ?? 'fallback';
  return createHmac('sha256', secret).update(`pin:${pin}`).digest('hex');
}

export async function POST(req: NextRequest) {
  // Verify portal session
  const token = cookies().get('cf_portal')?.value ?? '';
  const payload = await verifyPortalToken(token).catch(() => null);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const pin = String(body?.pin ?? '').trim();

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
  }

  await db.careerClient.update({
    where: { id: payload.clientId },
    data: { pinHash: hashPin(pin) },
  });

  return NextResponse.json({ ok: true });
}
