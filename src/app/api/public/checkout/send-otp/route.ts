import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, randomInt } from 'crypto';
import { Resend } from 'resend';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';
import { BRAND_EMAIL } from '@/lib/config';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email ?? '').toLowerCase().trim();
    const name = (body.name ?? '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const limited = await enforcePublicRateLimit(req, {
      action: 'checkout_otp',
      email,
      ipLimit:    { limit: 15, windowMs: 60 * 60 * 1000 },
      emailLimit: { limit: 5,  windowMs: 60 * 60 * 1000 },
    });
    if (limited) return limited;

    const code = String(randomInt(100000, 999999));
    const exp  = Date.now() + 10 * 60 * 1000;
    const sig  = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
      .update(`${email}:${code}:${exp}`)
      .digest('hex');

    const firstName = name.split(' ')[0] || 'there';

    await resend.emails.send({
      from: `Catalyst <${process.env.FROM_EMAIL ?? BRAND_EMAIL}>`,
      to: email,
      subject: `${code} — your Catalyst verification code`,
      html: `
        <div style="font-family: 'Georgia', serif; background: #F8F5F1; padding: 48px 24px;">
          <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border: 1px solid #EBE4D9; padding: 40px;">
            <p style="font-family: sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #B8935B; margin: 0 0 24px;">Catalyst · CareerPilot</p>
            <h1 style="font-size: 22px; font-weight: 400; color: #0A0B0D; margin: 0 0 12px; line-height: 1.3;">Hi ${firstName}, verify your email</h1>
            <p style="font-family: sans-serif; font-size: 14px; color: #6B6B6B; margin: 0 0 32px; line-height: 1.6;">Enter this code to continue with your order. It expires in 10 minutes.</p>
            <div style="background: #F8F5F1; border: 1px solid #EBE4D9; padding: 28px; text-align: center; margin-bottom: 32px;">
              <p style="font-family: 'Courier New', monospace; font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #0A0B0D; margin: 0;">${code}</p>
            </div>
            <p style="font-family: sans-serif; font-size: 12px; color: #9E9E9E; margin: 0; line-height: 1.6;">If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ token: `${sig}.${exp}` });
  } catch (error) {
    console.error('OTP send error:', error);
    return NextResponse.json({ error: 'Failed to send verification code. Please try again.' }, { status: 500 });
  }
}
