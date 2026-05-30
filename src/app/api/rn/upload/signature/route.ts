import { NextResponse, NextRequest } from 'next/server';
import { withTenant } from '@/lib/auth/withTenant';
import { getTenantDb } from '@/lib/db/tenantDb';
import { getTenantUploadSignature } from '@/lib/storage/tenantCloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withTenant(async (request, ctx) => {
  if (ctx.role !== 'SUPER_ADMIN' && ctx.tenantId !== 'ripple_nexus') {
    return NextResponse.json({ error: 'Unauthorized brand access' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  }

  const tenantDb = getTenantDb(ctx.tenantId);
  const client = await tenantDb.rnClient.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  try {
    const signatureData = await getTenantUploadSignature(ctx, client.id);
    return NextResponse.json(signatureData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate signature' }, { status: 500 });
  }
});
