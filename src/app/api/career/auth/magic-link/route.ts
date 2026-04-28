// src/app/api/career/auth/magic-link/route.ts
// Request a new magic link (for clients who have already been onboarded)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { checkMagicLinkRateLimit } from '@/lib/ratelimit';
import { withRetry } from '@/lib/career/utils';
import { PORTAL_URL } from '@/lib/config';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage } from '@/lib/career/types';

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Rate limit: 3 requests per email per hour — always return 200 for enumeration safety
  const limit = await checkMagicLinkRateLimit(email);
  if (!limit.allowed) {
    // Silent success — do not reveal limit to prevent enumeration
    return NextResponse.json({ ok: true });
  }

  try {
    const client = await withRetry(() =>
      db.careerClient.findUnique({ where: { email } })
    );

    // Always return 200 — do not reveal whether email exists
    if (!client) return NextResponse.json({ ok: true });

    // Don't regenerate if a valid unexpired token already exists
    if (client.magicToken && client.magicTokenExpiry && client.magicTokenExpiry > new Date()) {
      // Already has a valid token — silently skip (client should check their inbox)
      return NextResponse.json({ ok: true });
    }

    const magicToken  = generateMagicToken();
    const tokenExpiry = magicTokenExpiry();

    await withRetry(() =>
      db.careerClient.update({
        where: { id: client.id },
        data:  { magicToken, magicTokenExpiry: tokenExpiry },
      })
    );

    const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;

    // Returning client → LOGIN_LINK email (not the Welcome onboarding email)
    const isFirstLogin = !client.lastLoginAt;
    const trigger = isFirstLogin ? 'WELCOME' : 'LOGIN_LINK';
    const emailData = isFirstLogin
      ? {
          name: client.name,
          packageLabel: PACKAGE_LABELS[client.packageType as CareerPackage] ?? 'Career Services',
          portalUrl,
        }
      : { name: client.name, portalUrl };

    try {
      await sendCareerEmail({ to: email, trigger, data: emailData });
    } catch (err) {
      console.error('[career/magic-link] Email failed:', err);
      // Return 503 only for email failure — DB is fine, but client won't get the link
      return NextResponse.json(
        { error: 'Could not send login email. Please try again in a moment.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[career/magic-link] DB error:', err);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    );
  }
}
