import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/authToken';
import LoginClient from './LoginClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SECRET ?? '';
}

export default async function LoginPage() {
  // Already logged in → go straight to dashboard
  const secret = getSecret();
  if (secret) {
    const token = cookies().get('cf_admin')?.value ?? '';
    const ok = await verifySessionToken(secret, token);
    if (ok) redirect('/');
  }

  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
