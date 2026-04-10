import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from './src/lib/authToken';

const COOKIE_NAME = 'cf_admin';

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SECRET ?? '';
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/favicon.png') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/sitemap.xml') return true;

  // Auth endpoints + login page
  if (pathname === '/login') return true;
  if (pathname.startsWith('/api/auth/')) return true;

  // External webhook (authenticated by signature, not cookies)
  if (pathname === '/api/razorpay/webhook' || pathname.startsWith('/api/razorpay/webhook/')) return true;

  // Career Booster — career webhook + portal has its own JWT auth
  if (pathname === '/api/career/webhook') return true;
  if (pathname.startsWith('/api/career/auth/')) return true;  // includes magic-link, verify, pin-login (set-pin requires session)
  if (pathname.startsWith('/api/career/portal/')) return true;
  if (pathname.startsWith('/portal')) return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const secret = getSecret();
    const token = request.cookies.get(COOKIE_NAME)?.value ?? '';

    // If no secret is configured, always block — misconfiguration must not grant access
    if (!secret) {
      throw new Error('ADMIN_SESSION_SECRET is not configured');
    }

    const ok = await verifySessionToken(secret, token);
    if (ok) return NextResponse.next();
  } catch {
    // Fall through to redirect/401 below
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const next = `${pathname}${search}`;
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
