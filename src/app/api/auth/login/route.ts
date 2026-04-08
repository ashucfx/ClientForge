import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSessionToken, getAdminCookieName, getAdminPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { password?: string } | null;
    const password = body?.password ?? '';

    if (!password || password !== getAdminPassword()) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createAdminSessionToken();
    const res = NextResponse.json({ ok: true });

    const ttlSeconds = process.env.ADMIN_SESSION_TTL_SECONDS
      ? Number(process.env.ADMIN_SESSION_TTL_SECONDS)
      : 60 * 60 * 8;

    res.cookies.set({
      name: getAdminCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
