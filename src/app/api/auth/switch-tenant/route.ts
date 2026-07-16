// src/app/api/auth/switch-tenant/route.ts
// Re-issues the session JWT with a different activeTenant for admins who
// have access to both portals (or SUPER_ADMIN). This is the ONLY way to
// change tenant context — the value lives inside the signed token.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createAdminSessionToken, getAdminCookieName, getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_BRANDS = new Set(['catalyst', 'ripple_nexus']);

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { brand?: string } | null;
    const brand = body?.brand ?? '';
    if (!VALID_BRANDS.has(brand)) {
      return NextResponse.json({ error: 'Invalid brand' }, { status: 400 });
    }

    // Re-read the admin so revoked access takes effect immediately.
    const adminUser = await prisma.adminUser.findUnique({ where: { id: session.adminId } });
    if (!adminUser || !adminUser.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !adminUser.brandAccess.includes(brand)) {
      return NextResponse.json({ error: 'No access to that portal' }, { status: 403 });
    }

    const token = await createAdminSessionToken({
      adminId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      brandAccess: adminUser.brandAccess,
      activeTenant: brand,
    });

    const redirectTo = brand === 'ripple_nexus' ? '/rn/dashboard' : '/';
    const res = NextResponse.json({ ok: true, brand, redirectTo });
    const secure = process.env.NODE_ENV === 'production';

    res.cookies.set({
      name: getAdminCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    res.cookies.set({
      name: 'cf_active_brand',
      value: brand,
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    console.error('Switch tenant error:', e);
    return NextResponse.json({ error: 'Switch failed' }, { status: 500 });
  }
}
