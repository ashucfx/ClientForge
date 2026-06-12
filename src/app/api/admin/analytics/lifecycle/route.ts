import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 1. Total Archived Clients
    const archivedCareer = await db.careerClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const archivedRn = await db.rnClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const totalArchived = archivedCareer + archivedRn;

    // 2. Reactivation Rate & Repeat Client Revenue
    // Fixed SQL: use totalPayable instead of amount
    const repeatRevenueQuery = await db.$queryRaw`
      SELECT 
        SUM(i."totalPayable") as "totalRevenue",
        COUNT(DISTINCT l."clientId") as "uniqueClients"
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON') AND i."status" = 'PAID'
    `;

    const repeatData = (repeatRevenueQuery as any[])[0] || { totalRevenue: 0, uniqueClients: 0 };
    const repeatRevenue = Number(repeatData.totalRevenue || 0);
    const totalReactivated = Number(repeatData.uniqueClients || 0);

    // Reactivation Rate = Total Reactivated / Total Clients
    const totalCareerClients = await db.careerClient.count();
    const totalRnClients = await db.rnClient.count();
    const totalClients = totalCareerClients + totalRnClients;
    const reactivationRate = totalClients > 0 ? (totalReactivated / totalClients) * 100 : 0;

    // 3. LTV (Lifetime Value) = Average Revenue Per Client
    const currentRevenueAggr = await db.invoice.aggregate({
      _sum: { totalPayable: true },
      where: { status: 'PAID' }
    });
    
    const totalRevenue = Number(currentRevenueAggr._sum.totalPayable || 0);
    const ltv = totalClients > 0 ? totalRevenue / totalClients : 0;

    // Calculate Reactivation Trend (last 30 days vs previous 30 days)
    const currentReactivatedQuery = await db.$queryRaw`
      SELECT COUNT(DISTINCT l."clientId") as count
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON') AND i."status" = 'PAID' AND i."paidAt" >= ${thirtyDaysAgo} AND i."paidAt" < ${now}
    `;
    const prevReactivatedQuery = await db.$queryRaw`
      SELECT COUNT(DISTINCT l."clientId") as count
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON') AND i."status" = 'PAID' AND i."paidAt" >= ${sixtyDaysAgo} AND i."paidAt" < ${thirtyDaysAgo}
    `;

    const currentReactivatedCount = Number((currentReactivatedQuery as any[])[0]?.count || 0);
    const prevReactivatedCount = Number((prevReactivatedQuery as any[])[0]?.count || 0);
    const reactivationTrend = calculateTrend(currentReactivatedCount, prevReactivatedCount);

    return NextResponse.json({
      totalArchived,
      totalReactivated,
      reactivationRate: reactivationRate.toFixed(1),
      repeatRevenue,
      ltv: Math.round(ltv),
      trends: {
        reactivationTrend
      }
    });

  } catch (err) {
    console.error('Lifecycle Analytics Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
