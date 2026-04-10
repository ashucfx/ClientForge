// src/app/api/career/auth/verify/route.ts
// Verify magic token → issue portal session cookie

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { createPortalToken, PORTAL_COOKIE, portalCookieOptions } from '@/lib/career/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = (body?.token as string | undefined)?.trim();

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const client = await db.careerClient.findFirst({
    where: {
      magicToken: token,
      magicTokenExpiry: { gt: new Date() },
    },
    select: { id: true, email: true, name: true, pinHash: true },
  });

  if (!client) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Burn the magic token — one-time use
  await db.careerClient.update({
    where: { id: client.id },
    data: {
      magicToken: null,
      magicTokenExpiry: null,
      lastLoginAt: new Date(),
    },
  });

  const sessionToken = await createPortalToken(client.id, client.email);
  const hasPinSet = !!client.pinHash;

  const res = NextResponse.json({ ok: true, name: client.name, hasPinSet });
  res.cookies.set(PORTAL_COOKIE, sessionToken, portalCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
