import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyCsrf } from '@/lib/auth';
import { checkOtpRateLimit } from '@/lib/ratelimit';
import { createRnClientSession } from '@/lib/rn/auth';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { clientId, magicToken, otp } = await request.json();

    if (!otp || otp.length !== 6 || !clientId || !magicToken) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Rate-limit: 5 attempts per clientId per 15 minutes
    const limit = await checkOtpRateLimit(clientId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new OTP.' },
        { status: 429 },
      );
    }

    const client = await prisma.rnClient.findFirst({
      where: { id: clientId, magicToken },
    });

    if (!client || !client.pinHash) {
      return NextResponse.json({ error: 'Invalid session or OTP expired' }, { status: 400 });
    }

    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(inputHash, 'utf8'),
      Buffer.from(client.pinHash, 'utf8'),
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect OTP' }, { status: 401 });
    }

    // Clear the pinHash immediately so it cannot be replayed
    await prisma.rnClient.update({
      where: { id: client.id },
      data: { pinHash: null, lastLoginAt: new Date() },
    });

    const token = await createRnClientSession({ clientId: client.id, email: client.email });

    cookies().set('rn_client_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[RN verify-otp] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
