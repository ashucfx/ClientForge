import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCsrf } from '@/lib/auth';
import { checkOtpSendRateLimit } from '@/lib/ratelimit';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { clientId, magicToken } = await request.json();

    if (!clientId || !magicToken) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Rate-limit OTP sends per clientId (3 per 10 minutes)
    const sendLimit = await checkOtpSendRateLimit(clientId);
    if (!sendLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait before trying again.' },
        { status: 429 },
      );
    }

    const client = await prisma.rnClient.findFirst({
      where: { id: clientId, magicToken },
    });

    if (!client) {
      return NextResponse.json({ error: 'Invalid magic token or client' }, { status: 400 });
    }

    // Generate a cryptographically random 6-digit OTP
    const otp = (crypto.randomInt(100000, 999999)).toString();
    const pinHash = crypto.createHash('sha256').update(otp).digest('hex');

    await prisma.rnClient.update({
      where: { id: client.id },
      data: { pinHash },
    });

    const { sendRnOtpEmail } = await import('@/lib/rn/email');
    await sendRnOtpEmail(client.email, otp);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[RN send-otp] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}