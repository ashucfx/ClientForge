// src/lib/auth/rnAdmin.ts
// Single source of truth for "is this request an RN admin?" — every RN admin
// API route should use this instead of hand-rolling the check.

import { getAdminSession } from '@/lib/auth';

export type RnAdminSession = {
  adminId: string;
  role: string;
  brandAccess: string[];
  activeTenant: string;
};

/**
 * Returns the admin session when the caller may operate on Ripple Nexus data
 * (SUPER_ADMIN, or brandAccess includes 'ripple_nexus'); otherwise null.
 * Middleware enforces this at the edge too — this is defense-in-depth.
 */
export async function requireRnAdmin(): Promise<RnAdminSession | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus')) return null;
  return session;
}
