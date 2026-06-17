import { NextResponse } from 'next/server';
import { getAdminCookieName } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set({ name: getAdminCookieName(), value: '', httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
  res.cookies.set({ name: 'cf_active_brand', value: '', httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
  return res;
}

