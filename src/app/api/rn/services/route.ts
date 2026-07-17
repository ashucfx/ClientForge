import { NextResponse, NextRequest } from 'next/server';
import { withTenant } from '@/lib/auth/withTenant';
import { getTenantDb } from '@/lib/db/tenantDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withTenant(async (request, ctx) => {
  if (ctx.role !== 'SUPER_ADMIN' && ctx.tenantId !== 'ripple_nexus') {
    return NextResponse.json({ error: 'Unauthorized brand access' }, { status: 403 });
  }

  try {
    const tenantDb = getTenantDb(ctx.tenantId);
    const services = await tenantDb.rnServiceModule.findMany({
      orderBy: { name: 'asc' }
    });
    
    const templates = await tenantDb.rnServiceTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { milestoneTemplates: { orderBy: { order: 'asc' } } }
    });
    
    const mappedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      workflowStages: t.milestoneTemplates.map(m => m.title)
    }));

    return NextResponse.json({ services: [...services, ...mappedTemplates] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
});

export const POST = withTenant(async (request, ctx) => {
  if (ctx.role !== 'SUPER_ADMIN' && ctx.tenantId !== 'ripple_nexus') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const tenantDb = getTenantDb(ctx.tenantId);
    const service = await tenantDb.rnServiceModule.create({
      data: {
        slug: body.slug,
        name: body.name,
        workflowStages: body.workflowStages || ['NOT_STARTED', 'IN_PROGRESS', 'DELIVERED'],
        revisionLimit: Number(body.revisionLimit) || 3,
        revisionCharge: Number(body.revisionCharge) || 0,
        defaultSlaDays: Number(body.defaultSlaDays) || 30,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    return NextResponse.json({ service });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const PUT = withTenant(async (request, ctx) => {
  if (ctx.role !== 'SUPER_ADMIN' && ctx.tenantId !== 'ripple_nexus') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const tenantDb = getTenantDb(ctx.tenantId);
    const service = await tenantDb.rnServiceModule.update({
      where: { id },
      data
    });
    return NextResponse.json({ service });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
