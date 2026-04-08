import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/authToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'cf_admin';

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SECRET ?? '';
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const secret = getSecret();
  const token = cookies().get(COOKIE_NAME)?.value ?? '';

  const ok = secret ? await verifySessionToken(secret, token) : false;
  if (!ok) redirect('/login');

  return children;
}

