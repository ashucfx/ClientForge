// src/app/api/rn/projects/export/route.ts
// CSV export of all RN projects for offline reporting.

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const clients = await db.rnClient.findMany({
    include: { serviceModule: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'Client', 'Company', 'Email', 'Service', 'Stage', 'Lifecycle',
    'Amount Paid', 'Currency', 'Expected Delivery', 'Completed At', 'Created At',
  ];
  const rows = clients.map(c => [
    c.name, c.companyName ?? '', c.email, c.serviceModule?.name ?? '',
    c.currentStage, c.lifecycleStatus, c.amountPaid, c.currency,
    c.expectedDeliveryAt?.toISOString().slice(0, 10) ?? '',
    c.completedAt?.toISOString().slice(0, 10) ?? '',
    c.createdAt.toISOString().slice(0, 10),
  ]);

  const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ripple-nexus-projects-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
