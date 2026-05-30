// src/app/api/catalyst/invoices/route.ts
// Tenant-Namespaced Catalyst Invoice API
// Enforces: activeTenant === 'catalyst' via tenantApiGuard
// Delegates all business logic to the shared Prisma layer

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { catalystApiGuard } from '@/lib/tenant/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── GET /api/catalyst/invoices ────────────────────────────────────
// Returns ONLY Catalyst invoices. brandId is always 'catalyst' server-side.
export async function GET(request: NextRequest) {
  const guard = await catalystApiGuard(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const status      = searchParams.get('status');
  const clientType  = searchParams.get('clientType');
  const search      = searchParams.get('search');
  const pageParsed  = Number(searchParams.get('page') ?? '1');
  const limitParsed = Number(searchParams.get('limit') ?? '100');
  const page  = Number.isFinite(pageParsed)  && pageParsed  > 0 ? Math.floor(pageParsed)  : 1;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(200, Math.floor(limitParsed)) : 100;

  const allowedStatus     = new Set(['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'EXPIRED']);
  const allowedClientType = new Set(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS']);
  if (status && !allowedStatus.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (clientType && !allowedClientType.has(clientType)) {
    return NextResponse.json({ error: 'Invalid clientType filter' }, { status: 400 });
  }

  // Hard-coded brandId: 'catalyst' — always enforced server-side, no cookie param
  const where: Record<string, unknown> = { brandId: 'catalyst' };

  if (status)     where.status     = status;
  if (clientType) where.clientType = clientType;
  if (search) {
    where.OR = [
      { clientName:    { contains: search, mode: 'insensitive' } },
      { clientEmail:   { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { companyName:   { contains: search, mode: 'insensitive' } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
