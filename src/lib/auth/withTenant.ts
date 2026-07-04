import { NextRequest, NextResponse } from 'next/server';
import { TenantContext, createTenantContext } from './TenantContext';
import { getAdminSession } from '@/lib/auth';

export type TenantHandler<T = any> = (
  req: NextRequest,
  ctx: TenantContext,
  params: T
) => Promise<NextResponse>;

/**
 * Wraps an API route handler to guarantee TenantContext injection.
 */
export function withTenant<T = any>(handler: TenantHandler<T>) {
  return async (req: NextRequest, { params }: { params: T }) => {
    // SECURITY: identity is ALWAYS derived from the signed session cookie.
    // We never read x-tenant-id / x-admin-id / x-admin-role from the request:
    // those headers are forgeable by any external client, and middleware sets
    // them on the response (not the forwarded request), so trusting them here
    // would let an attacker spoof an admin/tenant. See audit finding #1.
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Missing session' }, { status: 401 });
    }

    const tenantId = session.activeTenant;
    const adminId = session.adminId;
    const role = session.role;

    if (!tenantId || !adminId || !role) {
      return NextResponse.json({ error: 'Unauthorized: Missing tenant context' }, { status: 401 });
    }

    const brandAccess: string[] = session.brandAccess?.length ? session.brandAccess : [tenantId];
    const ctx = createTenantContext(tenantId, adminId, role, brandAccess);

    try {
      return await handler(req, ctx, params);
    } catch (err: any) {
      console.error('[TenantError]', err);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  };
}
