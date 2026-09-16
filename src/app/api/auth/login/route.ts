import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSessionToken, getAdminCookieName, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = (forwarded ? forwarded.split(',')[0].trim() : null) || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
    const limit = await rateLimit(`admin_login:${ip}`, 'admin_login', 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null) as { email?: string; password?: string; brand?: string } | null;
    const email = body?.email ?? '';
    const password = body?.password ?? '';
    const brand = body?.brand ?? 'catalyst';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!adminUser || !adminUser.isActive) {
      return NextResponse.json({ error: 'Invalid credentials or inactive account' }, { status: 401 });
    }

    if (!(await verifyPassword(password, adminUser.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login timestamp
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Record session login in audit logs with timestamp & IP
    await prisma.auditLog.create({
      data: {
        tenantId: 'catalyst',
        adminId: adminUser.id,
        action: 'ADMIN_LOGIN',
        entity: 'AdminUser',
        entityId: adminUser.id,
        changes: {
          email: adminUser.email,
          role: adminUser.role,
          ip,
          userAgent: request.headers.get('user-agent') ?? 'unknown',
          loggedInAt: new Date().toISOString(),
        },
      },
    }).catch(err => console.error('[login] AuditLog failed:', err));

    const token = await createAdminSessionToken({
      adminId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      brandAccess: ['catalyst'],
      activeTenant: 'catalyst',
    });

    const res = NextResponse.json({
      ok: true,
      role: adminUser.role,
      brandAccess: ['catalyst'],
      brand: 'catalyst',
      redirectTo: '/',
    });


    res.cookies.set({
      name:     getAdminCookieName(),
      value:    token,
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   60 * 60 * 8, // 8 hours — matches token TTL
    });
    
    // Set the active brand cookie — now httpOnly so XSS cannot forge tenant context
    res.cookies.set({
      name:     'cf_active_brand',
      value:    'catalyst',
      httpOnly: true, // 🔐 Fixed: was false — XSS could tamper brand context
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 8,
      secure:   process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
