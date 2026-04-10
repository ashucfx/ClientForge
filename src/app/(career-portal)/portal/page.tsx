// src/app/(career-portal)/portal/page.tsx
// Root portal redirect — send to dashboard if session exists, else login

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyPortalToken } from '@/lib/career/auth';

export const dynamic = 'force-dynamic';

export default async function PortalRootPage() {
  const token = cookies().get('cf_portal')?.value ?? '';
  const payload = await verifyPortalToken(token).catch(() => null);

  if (payload) {
    redirect('/portal/dashboard');
  } else {
    redirect('/portal/login');
  }
}
