// src/lib/tenant/resolver.ts
// Resolves tenant identity from hostname (production) or URL path (local dev)

export type TenantId = 'catalyst' | 'ripple_nexus';

/**
 * Resolves which tenant a given hostname belongs to.
 * In production: subdomain-based (catalyst.clientforge.com → catalyst)
 * In development: path-based (middleware handles this)
 */
export function resolveTenantFromHostname(hostname: string): TenantId | null {
  // Production subdomain patterns
  if (hostname.startsWith('catalyst.')) return 'catalyst';
  if (hostname.startsWith('rn.')) return 'ripple_nexus';
  if (hostname.startsWith('workspace.')) return 'ripple_nexus';

  // Exact domain matches (for white-label future)
  const domainMap: Record<string, TenantId> = {
    'catalyst.clientforge.com': 'catalyst',
    'rn.clientforge.com': 'ripple_nexus',
    'workspace.theripplenexus.com': 'ripple_nexus',
    'catalyst.theripplenexus.com': 'catalyst',
  };

  return domainMap[hostname] ?? null;
}

/**
 * Resolves tenant from a URL pathname (local dev fallback).
 */
export function resolveTenantFromPath(pathname: string): TenantId {
  if (pathname.startsWith('/rn')) return 'ripple_nexus';
  return 'catalyst';
}

/**
 * Full tenant resolution: hostname first, path fallback.
 */
export function resolveTenant(hostname: string, pathname: string): TenantId {
  return resolveTenantFromHostname(hostname) ?? resolveTenantFromPath(pathname);
}

/**
 * Returns the canonical base URL for a given tenant.
 */
export function getTenantBaseUrl(tenantId: TenantId): string {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    return tenantId === 'ripple_nexus' ? '/rn' : '';
  }
  // Production subdomains
  if (tenantId === 'ripple_nexus') {
    return process.env.NEXT_PUBLIC_RN_URL ?? 'https://rn.clientforge.com';
  }
  return process.env.NEXT_PUBLIC_CATALYST_URL ?? 'https://catalyst.clientforge.com';
}

/**
 * Returns the post-login redirect path for a given tenant.
 */
export function getTenantDashboardPath(tenantId: TenantId): string {
  return tenantId === 'ripple_nexus' ? '/rn/dashboard' : '/';
}
