// src/app/(career-portal)/portal/login/page.tsx

import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const metadata = { title: 'Client Portal — Catalyst' };

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
