import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Total Archived Clients
    const archivedCareer = await db.careerClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const archivedRn = await db.rnClient.count({
      where: { lifecycleStatus: 'ARCHIVED' }
    });
    const totalArchived = archivedCareer + archivedRn;

    // 2. Reactivation Rate & Repeat Client Revenue
    // Using aggregation to avoid memory overload
    const repeatInvoiceStats = await db.invoiceClientLink.aggregate({
      where: { purpose: { in: ['UPGRADE', 'REVISION', 'ADDON'] } },
      _count: { invoiceId: true } // just for counting links if needed
    });

    // To get the actual sum of invoice amounts and unique reactivated clients:
    // We can use queryRaw for high performance at scale
    const repeatRevenueQuery = await db.$queryRaw`
      SELECT 
        SUM(i."amount") as "totalRevenue",
        COUNT(DISTINCT l."clientId") as "uniqueClients"
      FROM "InvoiceClientLink" l
      JOIN "Invoice" i ON l."invoiceId" = i.id
      WHERE l."purpose" IN ('UPGRADE', 'REVISION', 'ADDON')
    `;

    const repeatData = (repeatRevenueQuery as any[])[0] || { totalRevenue: 0, uniqueClients: 0 };
    const repeatRevenue = Number(repeatData.totalRevenue || 0);
    const totalReactivated = Number(repeatData.uniqueClients || 0);

    // Reactivation Rate = Total Reactivated / Total Clients
    const totalCareerClients = await db.careerClient.count();
    const reactivationRate = totalCareerClients > 0 ? (totalReactivated / totalCareerClients) * 100 : 0;

    // 3. LTV (Lifetime Value) = Average Revenue Per Client
    const careerAgg = await db.careerClient.aggregate({
      _sum: { amountPaid: true }
    });
    const rnAgg = await db.rnClient.aggregate({
      _sum: { amountPaid: true }
    });
    
    const totalRevenue = Number(careerAgg._sum.amountPaid || 0) + Number(rnAgg._sum.amountPaid || 0);
    const totalClients = totalCareerClients + await db.rnClient.count();
    
    const ltv = totalClients > 0 ? totalRevenue / totalClients : 0;

    return NextResponse.json({
      totalArchived,
      totalReactivated,
      reactivationRate: reactivationRate.toFixed(1),
      repeatRevenue,
      ltv: ltv.toFixed(0),
    });

  } catch (err) {
    console.error('Lifecycle Analytics Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
