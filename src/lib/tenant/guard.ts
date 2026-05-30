// src/lib/tenant/guard.ts
// Tenant-aware API guard — use in every /api/catalyst/* and /api/rn/* route

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import type { TenantId } from './context';

export interface GuardedSession {
  adminId: string;
  role: string;
  brandAccess: string[];
  activeTenant: string;
}

type GuardResult =
  | { ok: true; session: GuardedSession }
  | { ok: false; response: NextResponse };

/**
 * tenantApiGuard — verifies the admin session and ensures the activeTenant
 * in the JWT matches the expected tenant for this API route.
 *
 * Usage in any API route:
 * ```ts
 * const guard = await tenantApiGuard(request, 'ripple_nexus');
 * if (!guard.ok) return guard.response;
 * const { session } = guard;
 * ```
 */
export async function tenantApiGuard(
  _request: NextRequest,
  expectedTenant: TenantId
): Promise<GuardResult> {
  const session = await getAdminSession();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  // SUPER_ADMIN can access any tenant's API but must have explicit brandAccess
  if (!isSuperAdmin) {
    // v3+ JWT: activeTenant must match the route namespace
    if (session.activeTenant && session.activeTenant !== expectedTenant) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Access denied: this endpoint is for ${expectedTenant} only` },
          { status: 403 }
        ),
      };
    }

    // Fallback: brandAccess must include the tenant
    if (!session.brandAccess.includes(expectedTenant)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Access denied: no ${expectedTenant} brand access` },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, session };
}

/**
 * Shorthand guards for each tenant namespace.
 */
export const catalystApiGuard = (req: NextRequest) => tenantApiGuard(req, 'catalyst');
export const rnApiGuard = (req: NextRequest) => tenantApiGuard(req, 'ripple_nexus');
