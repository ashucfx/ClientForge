// src/lib/tenant/context.ts
// TenantContext types for the multi-tenant architecture

// Re-use TenantId from resolver (single source of truth)
import type { TenantId } from './resolver';
export type { TenantId };

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';

export interface TenantTheme {
  primaryColor: string;
  secondaryColor: string;
  sidebarBg: string;
  brandGradient: string;
  logoVariant: 'catalyst' | 'ripple_nexus';
}

export interface TenantConfig {
  id: TenantId;
  displayName: string;
  theme: TenantTheme;
  apiNamespace: string;   // e.g. '/api/catalyst' | '/api/rn'
  dashboardPath: string;  // e.g. '/' | '/rn/dashboard'
  allowedRoles: AdminRole[];
}

export interface TenantContext {
  tenantId: TenantId;
  adminId: string;
  role: AdminRole;
  brandAccess: string[];
  activeTenant: string;
  config: TenantConfig;
}

// ─── Tenant Configurations ────────────────────────────────────────────────

export const TENANT_CONFIGS: Record<TenantId, TenantConfig> = {
  catalyst: {
    id: 'catalyst',
    displayName: 'Catalyst',
    theme: {
      primaryColor: '#1F56D4',
      secondaryColor: '#3FBD8B',
      sidebarBg: '#0F0A1E',
      brandGradient: 'linear-gradient(135deg, #1F56D4, #3FBD8B)',
      logoVariant: 'catalyst',
    },
    apiNamespace: '/api/catalyst',
    dashboardPath: '/',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'],
  },
  ripple_nexus: {
    id: 'ripple_nexus',
    displayName: 'Ripple Nexus',
    theme: {
      primaryColor: '#7C5CFF',
      secondaryColor: '#06B6D4',
      sidebarBg: '#0A1628',
      brandGradient: 'linear-gradient(135deg, #7C5CFF, #06B6D4)',
      logoVariant: 'ripple_nexus',
    },
    apiNamespace: '/api/rn',
    dashboardPath: '/rn/dashboard',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'],
  },
};

export function getTenantConfig(tenantId: TenantId): TenantConfig {
  return TENANT_CONFIGS[tenantId];
}

export function getTenantIdFromBrand(brand: string): TenantId {
  if (brand === 'ripple_nexus') return 'ripple_nexus';
  return 'catalyst';
}
