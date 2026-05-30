// src/app/api/rn/invoices/route.ts
// Tenant-Namespaced Ripple Nexus Invoice API
// Enforces: activeTenant === 'ripple_nexus' via tenantApiGuard
// Delegates all business logic to the shared invoice engine

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/auth/withTenant';
import { getTenantDb } from '@/lib/db/tenantDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withTenant(async (request, ctx) => {
  // Enforce RN-only access (redundant check for safety, but middleware handles it)
  if (ctx.tenantId !== 'ripple_nexus') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status     = searchParams.get('status');
  const search     = searchParams.get('search');
  const pageParsed  = Number(searchParams.get('page') ?? '1');
  const limitParsed = Number(searchParams.get('limit') ?? '100');
  const page  = Number.isFinite(pageParsed)  && pageParsed  > 0 ? Math.floor(pageParsed)  : 1;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(200, Math.floor(limitParsed)) : 100;

  const allowedStatus = new Set(['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'EXPIRED']);
  if (status && !allowedStatus.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { clientName:    { contains: search, mode: 'insensitive' } },
      { clientEmail:   { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { companyName:   { contains: search, mode: 'insensitive' } },
    ];
  }

  // Use tenantDb instead of global prisma
  const tenantDb = getTenantDb(ctx.tenantId);

  const [invoices, total] = await Promise.all([
    tenantDb.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    tenantDb.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});
