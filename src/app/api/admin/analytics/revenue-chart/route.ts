import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SQL fragment for brand/channel/tier breakdown (approximate, for visualization only)
const inrConversionCase = Prisma.sql`(
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

type MonthCurrencyRow = { month: string; currency: string; total: string; count?: string };
type DrillRow = { label: string; total: string; count: string };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [invoiceMonthly, careerMonthly, rnMonthly, brandRows, channelRows, clientTypeRows] = await Promise.all([
    // Invoice monthly — grouped by month + currency so we can convert with live rates
    db.$queryRaw<MonthCurrencyRow[]>`
      SELECT
        TO_CHAR("paidAt", 'YYYY-MM') AS month,
        "currency",
        COALESCE(SUM("totalPayable"), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("paidAt", 'YYYY-MM'), "currency"
      ORDER BY month ASC
    `,
    // Career clients manually onboarded (no portal invoice), bucketed by enrollment month
    db.$queryRaw<MonthCurrencyRow[]>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS month,
        "currency",
        COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "CareerClient"
      WHERE "invoiceId" IS NULL AND "amountPaid" > 0
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM'), "currency"
      ORDER BY month ASC
    `,
    // RN clients manually onboarded (no portal invoice)
    db.$queryRaw<MonthCurrencyRow[]>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS month,
        "currency",
        COALESCE(SUM("amountPaid"), 0)::text AS total
      FROM "RnClient"
      WHERE "invoiceId" IS NULL AND "amountPaid" > 0
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM'), "currency"
      ORDER BY month ASC
    `,
    // Brand / channel / tier drilldowns (Invoice-only; approximate conversion is fine for charts)
    db.$queryRaw<DrillRow[]>`
      SELECT
        COALESCE("brandId", 'unknown') AS label,
        COALESCE(SUM(${inrConversionCase}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID' AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "brandId" ORDER BY total DESC
    `,
    db.$queryRaw<DrillRow[]>`
      SELECT
        COALESCE("sourceChannel", 'DIRECT') AS label,
        COALESCE(SUM(${inrConversionCase}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID' AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "sourceChannel" ORDER BY total DESC
    `,
    db.$queryRaw<DrillRow[]>`
      SELECT
        COALESCE("clientType"::text, 'UNKNOWN') AS label,
        COALESCE(SUM(${inrConversionCase}), 0)::text AS total,
        COUNT(*)::text AS count
      FROM "Invoice"
      WHERE "status" = 'PAID' AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY "clientType" ORDER BY total DESC
    `,
  ]);

  // Merge all three monthly sources into a single map keyed by month
  // Values: { invoiceInr, externalInr, invoiceCount }
  const monthMap = new Map<string, { invoiceInr: number; externalInr: number; invoiceCount: number }>();

  const ensureMonth = (m: string) => {
    if (!monthMap.has(m)) monthMap.set(m, { invoiceInr: 0, externalInr: 0, invoiceCount: 0 });
    return monthMap.get(m)!;
  };

  // Process rows with live rate conversion (amountToInr uses shared cache — effectively one API call)
  await Promise.all(
    invoiceMonthly.map(async r => {
      const inr = await amountToInr(Number(r.total), r.currency);
      const entry = ensureMonth(r.month);
      entry.invoiceInr += inr;
      entry.invoiceCount += Number(r.count ?? 0);
    })
  );

  await Promise.all(
    [...careerMonthly, ...rnMonthly].map(async r => {
      const inr = await amountToInr(Number(r.total), r.currency);
      ensureMonth(r.month).externalInr += inr;
    })
  );

  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      revenue: Math.round(v.invoiceInr + v.externalInr),
      invoiceRevenue: Math.round(v.invoiceInr),
      externalRevenue: Math.round(v.externalInr),
      count: v.invoiceCount,
    }));

  return NextResponse.json({
    monthly,
    byBrand:   brandRows.map(r   => ({ brand:   r.label, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
    byChannel: channelRows.map(r => ({ channel: r.label, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
    byTier:    clientTypeRows.map(r => ({ tier: r.label, revenue: Math.round(Number(r.total)), count: Number(r.count) })),
  });
}
