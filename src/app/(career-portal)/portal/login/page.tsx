// src/app/(career-portal)/portal/login/page.tsx

import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = {
  title: 'Catalyst Client Workspace | Catalyst TPA',
  description: 'Secure sign-in to your Catalyst client workspace for messages, project briefs, files, and invoices.',
  robots: { index: false, follow: false },
};

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<PortalSplash />}>
      <LoginClient />
    </Suspense>
  );
}

function PortalSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F7F5F0] px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#B8935B] border-t-transparent" />
        <div className="mt-6 max-w-sm rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm lg:hidden">
          <p className="text-sm font-semibold text-slate-900">Sign-in page taking a moment?</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Open the email sign-in page to enter your registered address and request a new link.</p>
          <Link href="/portal/login" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0A0B0D] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/50">
            Continue to email sign-in
          </Link>
        </div>
        <span className="sr-only">Loading the Catalyst sign-in page…</span>
      </div>
    </div>
  );
}
