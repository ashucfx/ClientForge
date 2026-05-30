import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';

export default async function RnLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  
  if (!session) {
    redirect('/login');
  }

  const { role, brandAccess, activeTenant } = session;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Defense-in-depth: middleware already enforces this at the edge,
  // but we check here too for any direct server-side access attempts.
  // Check activeTenant (v3+ JWT) first, then fall back to brandAccess check.
  if (!isSuperAdmin) {
    const hasRnTenant = activeTenant === 'ripple_nexus';
    const hasRnAccess = brandAccess.includes('ripple_nexus');
    if (!hasRnTenant && !hasRnAccess) {
      redirect('/'); // Catalyst admin — redirect to their dashboard
    }
  }

  return <>{children}</>;
}
