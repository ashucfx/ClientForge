import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSessionToken, getAdminCookieName, verifyPassword, verifyCsrf } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limit = await rateLimit(`admin_login:${ip}`, 'admin_login', 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF token validation failed' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
    const email = body?.email ?? '';
    const password = body?.password ?? '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!adminUser || !adminUser.isActive) {
      return NextResponse.json({ error: 'Invalid credentials or inactive account' }, { status: 401 });
    }

    if (!verifyPassword(password, adminUser.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createAdminSessionToken({
      adminId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
    
    const res = NextResponse.json({ ok: true, role: adminUser.role });


    res.cookies.set({
      name:     getAdminCookieName(),
      value:    token,
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   60 * 60 * 8, // 8 hours — matches token TTL
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
