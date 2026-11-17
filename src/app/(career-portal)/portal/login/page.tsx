// src/app/(career-portal)/portal/login/page.tsx

import { Suspense } from 'react';
import type { Metadata } from 'next';
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
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] to-[#F0EDE6] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#B8935B] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
