// src/app/api/career/auth/pin-login/route.ts
// Login with email + 6-digit PIN (alternative to magic link)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma as db } from '@/lib/db';
import { createPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { checkPinRateLimit, clearPinFailures } from '@/lib/ratelimit';
import { withRetry } from '@/lib/career/utils';

function hashPin(pin: string): string {
  const secret = process.env.CAREER_PORTAL_SECRET;
  if (!secret) throw new Error('CAREER_PORTAL_SECRET is not configured');
  return createHmac('sha256', secret).update(`pin:${pin}`).digest('hex');
}

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const pin   = String(body?.pin ?? '').trim();

  if (!email || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'Email and 6-digit PIN required' }, { status: 400 });
  }

  // Rate limit: 5 attempts per email per 15 minutes
  const limit = await checkPinRateLimit(email);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Please try again in 15 minutes or use a magic link.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const client = await withRetry(() =>
      db.careerClient.findUnique({ where: { email } })
    );

    if (!client || !client.pinHash) {
      return NextResponse.json(
        { error: 'Invalid credentials. Use magic link to log in.' },
        { status: 401 },
      );
    }

    if (client.pinHash !== hashPin(pin)) {
      return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
    }

    // Successful login — clear failure counter and update lastLoginAt
    await clearPinFailures(email);
    await withRetry(() =>
      db.careerClient.update({ where: { id: client.id }, data: { lastLoginAt: new Date() } })
    );

    const sessionToken = await createPortalToken(client.id, client.email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PORTAL_COOKIE, sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}
