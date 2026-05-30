import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { clientId, magicToken } = await request.json();
    
    const client = await prisma.rnClient.findFirst({
      where: { id: clientId, magicToken }
    });

    if (!client) {
      return NextResponse.json({ error: 'Invalid magic token or client' }, { status: 400 });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Save to DB
    await prisma.rnClient.update({
      where: { id: client.id },
      data: { pinHash }
    });

    const { sendRnOtpEmail } = await import('@/lib/rn/email');
    await sendRnOtpEmail(client.email, otp);
    console.log(`[RN OTP] OTP for ${client.email} is: ${otp}`);

    // If we're in dev mode or haven't configured Resend yet, this guarantees we can test it
    // because we can read the console log.
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
