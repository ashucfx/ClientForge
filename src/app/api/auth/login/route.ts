import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSessionToken, getAdminCookieName, verifyPassword } from '@/lib/auth';
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

    // Resolve the portal for this account. If the requested brand isn't
    // accessible but the account belongs to exactly one portal, sign them
    // into that portal instead of dead-ending on a 403 (the login form's
    // brand toggle defaults to Catalyst, which RN-only admins would trip on).
    const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';
    let effectiveBrand = brand;
    if (!isSuperAdmin && !adminUser.brandAccess.includes(brand)) {
      if (adminUser.brandAccess.length === 1) {
        effectiveBrand = adminUser.brandAccess[0];
      } else {
        return NextResponse.json(
          { error: `Account does not have access to the ${brand === 'catalyst' ? 'Catalyst' : 'Ripple Nexus'} portal.` },
          { status: 403 }
        );
      }
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
      brandAccess: adminUser.brandAccess,
      activeTenant: effectiveBrand, // 🔐 Cryptographically embedded — cannot be tampered via XSS
    });

    // Determine post-login redirect based on tenant
    const redirectTo = effectiveBrand === 'ripple_nexus' ? '/rn/dashboard' : '/';

    const res = NextResponse.json({
      ok: true,
      role: adminUser.role,
      brandAccess: adminUser.brandAccess,
      brand: effectiveBrand,
      redirectTo,
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
      value:    effectiveBrand,
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
