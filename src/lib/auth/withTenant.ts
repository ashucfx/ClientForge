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
    // Attempt to read from middleware-injected headers
    let tenantId = req.headers.get('x-tenant-id');
    let adminId = req.headers.get('x-admin-id');
    let role = req.headers.get('x-admin-role');

    // If middleware didn't inject them (e.g. API routes skipped by middleware),
    // parse the session directly here.
    if (!tenantId || !adminId || !role) {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized: Missing session' }, { status: 401 });
      }
      tenantId = session.activeTenant;
      adminId = session.adminId;
      role = session.role;
    }

    if (!tenantId || !adminId || !role) {
      return NextResponse.json({ error: 'Unauthorized: Missing tenant context' }, { status: 401 });
    }

    const brandAccess: string[] = [tenantId];
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
