// src/app/api/career/auth/magic-link/route.ts
// Request a new magic link (for clients who have already been onboarded)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

/** Neon free-tier can be paused — retry once after a short wait */
async function withNeonRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P1001' || code === 'P1017') {
      // DB was sleeping — wait 2 s and retry once
      await new Promise(r => setTimeout(r, 2000));
      return fn();
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  try {
    const client = await withNeonRetry(() =>
      db.careerClient.findUnique({ where: { email } })
    );

    // Always return 200 — don't reveal whether email exists
    if (!client) {
      return NextResponse.json({ ok: true });
    }

    const magicToken  = generateMagicToken();
    const tokenExpiry = magicTokenExpiry();

    await withNeonRetry(() =>
      db.careerClient.update({
        where: { id: client.id },
        data: { magicToken, magicTokenExpiry: tokenExpiry },
      })
    );

    const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;

    try {
      await sendCareerEmail({
        to: email,
        trigger: 'WELCOME',
        data: {
          name: client.name,
          packageLabel: PACKAGE_LABELS[client.packageType as CareerPackage],
          portalUrl,
        },
      });
    } catch (err) {
      console.error('[career/magic-link] Email failed:', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[career/magic-link] DB error:', err);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
