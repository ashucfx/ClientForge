import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Last 12 months of paid revenue, grouped by month
  const [monthlyRows, brandRows, channelRows, clientTypeRows] = await Promise.all([
    db.$queryRaw<Array<{ month: string; total: string; count: string }>>`
      SELECT
        TO_CHAR("paidAt", 'YYYY-MM') AS month,
        COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("paidAt", 'YYYY-MM')
      ORDER BY month ASC
    `,
    // Revenue by brand (Catalyst vs Ripple Nexus)
    db.$queryRaw<Array<{ brand: string; total: string; count: string }>>`
      SELECT
        COALESCE("brandId", 'unknown') AS brand,
        COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "brandId"
      ORDER BY total DESC
    `,
    // Revenue by source channel (CHECKOUT, INQUIRE, APPLY, ADMIN)
    db.$queryRaw<Array<{ channel: string; total: string; count: string }>>`
      SELECT
        COALESCE("sourceChannel", 'DIRECT') AS channel,
        COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "sourceChannel"
      ORDER BY total DESC
    `,
    // Revenue by client tier (FRESHER, MID_CAREER, EXECUTIVE, EXECUTIVE_PLUS)
    db.$queryRaw<Array<{ tier: string; total: string; count: string }>>`
      SELECT
        COALESCE("clientType"::text, 'UNKNOWN') AS tier,
        COALESCE(SUM("totalPayable" * "exchangeRate"), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "clientType"
      ORDER BY total DESC
    `,
  ]);

  return NextResponse.json({
    monthly: monthlyRows.map(r => ({
      month: r.month,
      revenue: Number(r.total),
      count: Number(r.count),
    })),
    byBrand: brandRows.map(r => ({
      brand: r.brand,
      revenue: Number(r.total),
      count: Number(r.count),
    })),
    byChannel: channelRows.map(r => ({
      channel: r.channel,
      revenue: Number(r.total),
      count: Number(r.count),
    })),
    byTier: clientTypeRows.map(r => ({
      tier: r.tier,
      revenue: Number(r.total),
      count: Number(r.count),
    })),
  });
}
