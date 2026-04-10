// src/app/(career-portal)/portal/login/page.tsx

import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const metadata = { title: 'Client Portal — Ripple Nexus' };

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<PortalSplash />}>
      <LoginClient />
    </Suspense>
  );
}

function PortalSplash() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
