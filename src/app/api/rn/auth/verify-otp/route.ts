import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { createRnClientSession } from '@/lib/rn/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { clientId, magicToken, otp } = await request.json();
    
    if (!otp || otp.length !== 6) {
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }

    const client = await prisma.rnClient.findFirst({
      where: { id: clientId, magicToken }
    });

    if (!client || !client.pinHash) {
      return NextResponse.json({ error: 'Invalid session or OTP expired' }, { status: 400 });
    }

    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (inputHash !== client.pinHash) {
      return NextResponse.json({ error: 'Incorrect OTP' }, { status: 401 });
    }

    // Success! Clear the pinHash so it can't be reused, update lastLoginAt
    await prisma.rnClient.update({
      where: { id: client.id },
      data: { pinHash: null, lastLoginAt: new Date() }
    });

    // Create session JWT
    const token = await createRnClientSession({ clientId: client.id, email: client.email });

    // Set cookie
    cookies().set('rn_client_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
