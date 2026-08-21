import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
  
    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
  
    if (monthParam) {
      const [y, m] = monthParam.split('-');
      const year = parseInt(y);
      const month = parseInt(m) - 1;
      currentStart = new Date(year, month, 1);
      currentEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      prevStart = new Date(year, month - 1, 1);
    } else {
      const now = new Date();
      currentEnd = now;
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    // 1. Total Archived Clients
    const archivedCareer = await db.careerClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const archivedRn = await db.rnClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const totalArchived = archivedCareer + archivedRn;

    // 2. Reactivation Rate & Repeat Client Revenue
    // FIX: Use subtotalConverted / exchangeRate to get net INR revenue (excluding fees & taxes)
    const repeatRevenueQuery = await db.$queryRaw`
      SELECT 
        SUM(i."subtotalConverted" / NULLIF(i."exchangeRate", 0)) as "totalRevenue",
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
    // FIX: Use subtotalConverted / exchangeRate (excludes Razorpay fees and taxes)
    const currentRevenueQuery = await db.$queryRaw`
      SELECT SUM("subtotalConverted" / NULLIF("exchangeRate", 0)) as total
      FROM "Invoice"
      WHERE "status" = 'PAID'
    `;
    
    const totalRevenue = Number((currentRevenueQuery as any[])[0]?.total || 0);
    const ltv = totalClients > 0 ? totalRevenue / totalClients : 0;

    // Calculate Reactivation Trend
    const currentReactivatedQuery = await db.$queryRaw`
      SELECT COUNT(DISTINCT l."clientId") as count
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON') AND i."status" = 'PAID' AND i."paidAt" >= ${currentStart} AND i."paidAt" <= ${currentEnd}
    `;
    const prevReactivatedQuery = await db.$queryRaw`
      SELECT COUNT(DISTINCT l."clientId") as count
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON') AND i."status" = 'PAID' AND i."paidAt" >= ${prevStart} AND i."paidAt" < ${currentStart}
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
