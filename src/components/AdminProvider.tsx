'use client';
// src/components/AdminProvider.tsx
import { createContext, useContext } from 'react';
import type { AdminRole } from '@prisma/client';

type AdminContextType = {
  adminId: string;
  role: AdminRole;
  brandAccess: string[];
  isSuperAdmin: boolean;
  hasCatalystAccess: boolean;
  hasRnAccess: boolean;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({
  children,
  adminId,
  role,
  brandAccess,
}: {
  children: React.ReactNode;
  adminId: string;
  role: string;
  brandAccess: string[];
}) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const hasCatalystAccess = isSuperAdmin || brandAccess.includes('catalyst');
  const hasRnAccess = isSuperAdmin || brandAccess.includes('ripple_nexus');

  return (
    <AdminContext.Provider
      value={{
        adminId,
        role: role as AdminRole,
        brandAccess,
        isSuperAdmin,
        hasCatalystAccess,
        hasRnAccess,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider');
  return ctx;
}
