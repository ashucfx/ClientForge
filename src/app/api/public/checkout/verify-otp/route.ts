import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email ?? '').toLowerCase().trim();
    const code  = (body.code  ?? '').trim();
    const token = (body.token ?? '').trim();

    if (!email || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const sig    = token.slice(0, dotIdx);
    const expStr = token.slice(dotIdx + 1);
    const exp    = parseInt(expStr, 10);

    if (isNaN(exp) || Date.now() > exp) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
      .update(`${email}:${code}:${exp}`)
      .digest('hex');

    const sigBuf      = Buffer.from(sig,      'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
