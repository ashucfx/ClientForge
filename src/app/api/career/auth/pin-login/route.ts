// src/app/api/career/auth/pin-login/route.ts
// Login with email + 6-digit PIN (alternative to magic link)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma as db } from '@/lib/db';
import { createPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

function hashPin(pin: string): string {
  const secret = process.env.CAREER_PORTAL_SECRET ?? 'fallback';
  return createHmac('sha256', secret).update(`pin:${pin}`).digest('hex');
}

/** Neon wake-up retry */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P1001' || code === 'P1017') {
      await new Promise(r => setTimeout(r, 2000));
      return fn();
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const pin   = String(body?.pin ?? '').trim();

  if (!email || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'Email and 6-digit PIN required' }, { status: 400 });
  }

  try {
    const client = await withRetry(() =>
      db.careerClient.findUnique({ where: { email } })
    );

    // Generic error — do not reveal whether account exists
    if (!client || !client.pinHash) {
      return NextResponse.json({ error: 'Invalid credentials. Use magic link to log in.' }, { status: 401 });
    }

    if (client.pinHash !== hashPin(pin)) {
      return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
    }

    // Update last login
    await withRetry(() =>
      db.careerClient.update({
        where: { id: client.id },
        data: { lastLoginAt: new Date() },
      })
    );

    const sessionToken = await createPortalToken(client.id, client.email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PORTAL_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
