import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import LoginClient from './LoginClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { switch?: string; next?: string };
}) {
  // Already logged in → go to the workspace of the ACTIVE tenant.
  // `?switch=1` bypasses this so a user can sign in with a different account.
  if (!searchParams.switch) {
    const session = await getAdminSession().catch(() => null);
    if (session) {
      redirect(session.activeTenant === 'ripple_nexus' ? '/rn/dashboard' : '/');
    }
  }

  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
