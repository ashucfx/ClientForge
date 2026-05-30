// src/lib/auth/TenantContext.ts

export type AdminRole = 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER' | string;

export interface TenantContext {
  /** The isolated tenant ID (e.g. 'catalyst' or 'ripple_nexus') */
  tenantId: string;
  
  /** The admin's unique ID */
  adminId: string;
  
  /** The admin's role in the system */
  role: AdminRole;
  
  /** Brands the admin explicitly has access to */
  brandAccess: string[];
}

export function createTenantContext(
  tenantId: string,
  adminId: string,
  role: string,
  brandAccess: string[]
): TenantContext {
  return {
    tenantId,
    adminId,
    role: role as AdminRole,
    brandAccess,
  };
}

/**
 * Asserts that the context possesses a required role.
 * Throws an error if not.
 */
export function assertRole(ctx: TenantContext, allowedRoles: AdminRole[]) {
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Forbidden: requires one of [${allowedRoles.join(', ')}]`);
  }
}
