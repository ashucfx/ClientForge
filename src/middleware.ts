// src/middleware.ts
// Tenant-Aware Routing Middleware
// Resolves tenant from URL path, verifies JWT activeTenant matches, enforces isolation.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// ─── Constants ─────────────────────────────────────────────────────────────
const ADMIN_COOKIE = 'cf_admin';
const ALGORITHM = 'HS256';

// ─── Tenant Resolution from Path ───────────────────────────────────────────
function resolveTenantFromPath(pathname: string): 'ripple_nexus' | 'catalyst' | null {
  if (pathname.startsWith('/rn') || pathname.startsWith('/api/rn')) {
    return 'ripple_nexus';
  }
  return null; // Catalyst is the default — no prefix required
}

// ─── JWT Decode (lightweight — no DB hit) ──────────────────────────────────
async function getSessionPayload(token: string): Promise<{
  adminId: string;
  role: string;
  activeTenant?: string;
  brandAccess?: string[];
} | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    return payload as {
      adminId: string;
      role: string;
      activeTenant?: string;
      brandAccess?: string[];
    };
  } catch {
    return null;
  }
}

// ─── Public paths that bypass auth ─────────────────────────────────────────
const PUBLIC_PREFIXES = [
  '/login',
  '/inquire',
  '/checkout',
  '/proposal',
  '/api/public',
  '/api/auth',
  '/api/health',
  '/api/currency',
  '/api/paypal/webhook',
  '/api/razorpay/webhook',
  '/api/cron',
  '/rn/portal',          // B2B client portal
  '/portal',             // Catalyst career portal
  '/api/career/webhook',
  '/api/career/auth',
  '/api/career/portal',
  '/_next',
  '/favicon',
  '/fonts',
  '/logo',
  '/images',
  '/robots.txt',
  '/sitemap.xml',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

// ─── Middleware ─────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public paths entirely
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 2. Only enforce on /rn/* and /(protected)/* routes (not API in general)
  const isRnRoute = pathname.startsWith('/rn');
  const isProtectedRoute = !pathname.startsWith('/api/'); // protect page routes

  // Skip non-page, non-rn API routes (they have their own guards)
  if (!isRnRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  // 3. Get the JWT from the cookie
  const token = request.cookies.get(ADMIN_COOKIE)?.value ?? '';

  // 4. Resolve the tenant the URL is asking for
  const urlTenant = resolveTenantFromPath(pathname);

  // 5. For RN routes specifically: verify JWT activeTenant matches
  if (isRnRoute) {
    if (!token) {
      // No session at all — redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = await getSessionPayload(token);

    if (!session) {
      // Invalid/expired token
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // For legacy sessions (v2 tokens without activeTenant), fall back to brandAccess check
    const activeTenant = session.activeTenant;
    const brandAccess = Array.isArray(session.brandAccess) ? session.brandAccess : [];
    const isSuperAdmin = session.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      // v3+ JWT: check activeTenant matches
      if (activeTenant && activeTenant !== 'ripple_nexus') {
        // User is logged in as Catalyst but trying to access RN routes
        // Redirect them to their correct portal
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Fallback for v2 tokens: check brandAccess
      if (!activeTenant && !brandAccess.includes('ripple_nexus')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // ✅ Valid RN session — inject tenant headers for RSCs
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', 'ripple_nexus');
    response.headers.set('x-admin-id', session.adminId);
    response.headers.set('x-admin-role', session.role);
    return response;
  }

  // 6. For all other protected page routes: just verify session exists
  if (isProtectedRoute && !pathname.startsWith('/api/')) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = await getSessionPayload(token);
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Inject tenant headers for Catalyst routes
    const response = NextResponse.next();
    const activeTenant = session.activeTenant ?? 'catalyst';
    response.headers.set('x-tenant-id', activeTenant);
    response.headers.set('x-admin-id', session.adminId);
    response.headers.set('x-admin-role', session.role);
    return response;
  }

  return NextResponse.next();
}

// ─── Matcher: which paths this middleware runs on ──────────────────────────
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
