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

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const secret = getSecret();
  const token = request.cookies.get(COOKIE_NAME)?.value ?? '';

  const ok = secret ? await verifySessionToken(secret, token) : false;
  if (ok) return NextResponse.next();

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
