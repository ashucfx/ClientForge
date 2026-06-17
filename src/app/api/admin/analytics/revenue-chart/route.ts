import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SQL fragment: converts totalPayable to INR-equivalent using approximate rates.
// exchangeRate is stored as 1 for all invoices, so we use the currency column instead.
const inrConversion = Prisma.sql`(
  "totalPayable" * CASE "currency"
    WHEN 'INR' THEN 1
    WHEN 'USD' THEN 83
    WHEN 'GBP' THEN 106
    WHEN 'EUR' THEN 90
    WHEN 'SGD' THEN 62
    WHEN 'AUD' THEN 54
    WHEN 'CAD' THEN 61
    WHEN 'AED' THEN 22.6
    ELSE 83
  END
)`;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [monthlyRows, brandRows, channelRows, clientTypeRows] = await Promise.all([
    db.$queryRaw<Array<{ month: string; total: string; count: string }>>`
      SELECT
        TO_CHAR("paidAt", 'YYYY-MM') AS month,
        COALESCE(SUM(${inrConversion}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("paidAt", 'YYYY-MM')
      ORDER BY month ASC
    `,
    db.$queryRaw<Array<{ brand: string; total: string; count: string }>>`
      SELECT
        COALESCE("brandId", 'unknown') AS brand,
        COALESCE(SUM(${inrConversion}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "brandId"
      ORDER BY total DESC
    `,
    db.$queryRaw<Array<{ channel: string; total: string; count: string }>>`
      SELECT
        COALESCE("sourceChannel", 'DIRECT') AS channel,
        COALESCE(SUM(${inrConversion}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "sourceChannel"
      ORDER BY total DESC
    `,
    db.$queryRaw<Array<{ tier: string; total: string; count: string }>>`
      SELECT
        COALESCE("clientType"::text, 'UNKNOWN') AS tier,
        COALESCE(SUM(${inrConversion}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "clientType"
      ORDER BY total DESC
    `,
  ]);

  return NextResponse.json({
    monthly: monthlyRows.map(r => ({ month: r.month, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
    byBrand: brandRows.map(r => ({ brand: r.brand, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
    byChannel: channelRows.map(r => ({ channel: r.channel, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
    byTier: clientTypeRows.map(r => ({ tier: r.tier, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
  });
}
