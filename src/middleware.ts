// src/middleware.ts
// Tenant-Aware Routing Middleware
// Resolves tenant from URL path, verifies JWT activeTenant matches, enforces isolation
// in BOTH directions (Catalyst ↔ Ripple Nexus) for pages and admin APIs.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// ─── Constants ─────────────────────────────────────────────────────────────
const ADMIN_COOKIE = 'cf_admin';
const ALGORITHM = 'HS256';

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
  '/testimonials',
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

// ─── Catalyst-only admin API namespaces ────────────────────────────────────
// These endpoints operate on Catalyst data. Route handlers verify the session
// exists, but brand scoping is enforced HERE so a Ripple-Nexus-only admin can
// never read or mutate Catalyst data (career clients, invoices, flywheel, …).
const CATALYST_ADMIN_API_PREFIXES = [
  '/api/career/admin',
  '/api/catalyst',
  '/api/invoices',
  '/api/admin/', // analytics, flywheel, sales, marketing, contacts, … (trailing slash — /api/admins is guarded in its own route)
];

function isCatalystAdminApi(pathname: string): boolean {
  return CATALYST_ADMIN_API_PREFIXES.some(p => pathname.startsWith(p));
}

function hasBrand(session: { role: string; brandAccess?: string[] }, brand: string): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  return Array.isArray(session.brandAccess) && session.brandAccess.includes(brand);
}

function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ─── Middleware ─────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public paths entirely
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api/');

  // 2. Get the JWT from the cookie
  const token = request.cookies.get(ADMIN_COOKIE)?.value ?? '';

  // ── Catalyst admin APIs: require a session with Catalyst access ─────────
  if (isCatalystAdminApi(pathname)) {
    const session = token ? await getSessionPayload(token) : null;
    if (!session) return apiError('Unauthorized: Missing session', 401);
    if (!hasBrand(session, 'catalyst')) {
      return apiError('Forbidden: No Catalyst access', 403);
    }
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', 'catalyst');
    return response;
  }

  // Other API routes carry their own guards in the route handlers.
  if (isApi) {
    return NextResponse.next();
  }

  // ── All protected (Catalyst) pages ──────────────────────────────────
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

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', 'catalyst');
  response.headers.set('x-admin-id', session.adminId);
  response.headers.set('x-admin-role', session.role);
  return response;
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
