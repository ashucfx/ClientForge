import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { AdminProvider } from '@/components/AdminProvider';
import { BrandProvider } from '@/components/BrandProvider';
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // getAdminSession verifies the JWT and returns activeTenant from the signed payload
  const session = await getAdminSession();
  if (!session) redirect('/login');

  const { adminId, role, brandAccess, activeTenant } = session;

  return (
    <AdminProvider adminId={adminId} role={role} brandAccess={brandAccess}>
      {/* activeTenant is derived from the cryptographically verified JWT, not a plain cookie */}
      <BrandProvider initialBrand={activeTenant}>
        {children}
        {/* Admin-only command palette — tenant-aware, never rendered on public/client-portal pages */}
        <GlobalCommandPalette />
      </BrandProvider>
    </AdminProvider>
  );
}

