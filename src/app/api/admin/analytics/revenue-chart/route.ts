import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Last 12 months of paid revenue, grouped by month
  const rows = await db.$queryRaw<Array<{ month: string; total: string; count: string }>>`
    SELECT
      TO_CHAR("paidAt", 'YYYY-MM') AS month,
      COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total,
      COUNT(*)::text AS count
    FROM "Invoice"
    WHERE "status" = 'PAID'
      AND "paidAt" >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR("paidAt", 'YYYY-MM')
    ORDER BY month ASC
  `;

  // Service breakdown for the same period
  const serviceRows = await db.$queryRaw<Array<{ brand: string; total: string }>>`
    SELECT
      "brandId" AS brand,
      COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total
    FROM "Invoice"
    WHERE "status" = 'PAID'
      AND "paidAt" >= NOW() - INTERVAL '12 months'
    GROUP BY "brandId"
    ORDER BY total DESC
  `;

  return NextResponse.json({
    monthly: rows.map(r => ({
      month: r.month,
      revenue: Number(r.total),
      count: Number(r.count),
    })),
    byBrand: serviceRows.map(r => ({
      brand: r.brand,
      revenue: Number(r.total),
    })),
  });
}
