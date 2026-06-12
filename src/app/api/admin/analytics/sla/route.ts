import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Helper to fetch SLA metrics
  const getSlaMetrics = async (startDate: Date, endDate: Date) => {
    // Current period
    const careerSlaQuery = await db.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN "completedAt" <= "slaDeadline" THEN 1 ELSE 0 END) as met,
        SUM(CASE WHEN "completedAt" > "slaDeadline" THEN 1 ELSE 0 END) as missed,
        SUM(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as totalDeliveryTimeMs
      FROM "CareerClient"
      WHERE "status" = 'COMPLETED' AND "slaDeadline" IS NOT NULL AND "completedAt" >= ${startDate} AND "completedAt" < ${endDate}
    `;

    const rnSlaQuery = await db.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN "completedAt" <= "slaDeadline" THEN 1 ELSE 0 END) as met,
        SUM(CASE WHEN "completedAt" > "slaDeadline" THEN 1 ELSE 0 END) as missed,
        SUM(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as totalDeliveryTimeMs
      FROM "RnClient"
      WHERE "currentStage" = 'LAUNCHED' AND "slaDeadline" IS NOT NULL AND "completedAt" >= ${startDate} AND "completedAt" < ${endDate}
    `;

    const careerData = (careerSlaQuery as any[])[0] || { total: 0, met: 0, missed: 0, totalDeliveryTimeMs: 0 };
    const rnData = (rnSlaQuery as any[])[0] || { total: 0, met: 0, missed: 0, totalDeliveryTimeMs: 0 };

    const totalCompleted = Number(careerData.total || 0) + Number(rnData.total || 0);
    const slaMet = Number(careerData.met || 0) + Number(rnData.met || 0);
    const slaMissed = Number(careerData.missed || 0) + Number(rnData.missed || 0);
    const totalDeliveryTimeMs = Number(careerData.totalDeliveryTimeMs || 0) + Number(rnData.totalDeliveryTimeMs || 0);

    const slaMetPercentage = totalCompleted > 0 ? Math.round((slaMet / totalCompleted) * 100) : null;
    const averageDeliveryTimeDays = totalCompleted > 0 ? Math.round(totalDeliveryTimeMs / totalCompleted / (1000 * 60 * 60 * 24)) : null;

    return { totalCompleted, slaMetPercentage, slaMet, slaMissed, averageDeliveryTimeDays };
  };

  const currentPeriod = await getSlaMetrics(thirtyDaysAgo, now);
  const prevPeriod = await getSlaMetrics(sixtyDaysAgo, thirtyDaysAgo);
  const lifetime = await getSlaMetrics(new Date(0), now);

  const totalCareerRevisions = await db.careerRevision.count({ where: { createdAt: { gte: thirtyDaysAgo } } });
  const totalRnRevisions = await db.rnRevision.count({ where: { createdAt: { gte: thirtyDaysAgo } } });
  const currentRevisions = totalCareerRevisions + totalRnRevisions;
  const revisionRate = currentPeriod.totalCompleted > 0 ? Number((currentRevisions / currentPeriod.totalCompleted).toFixed(1)) : 0;

  return NextResponse.json({
    current: currentPeriod,
    trends: {
      slaMetTrend: currentPeriod.slaMetPercentage !== null && prevPeriod.slaMetPercentage !== null ? currentPeriod.slaMetPercentage - prevPeriod.slaMetPercentage : 0,
      deliveryTimeTrend: currentPeriod.averageDeliveryTimeDays !== null && prevPeriod.averageDeliveryTimeDays !== null ? calculateTrend(currentPeriod.averageDeliveryTimeDays, prevPeriod.averageDeliveryTimeDays) : 0,
    },
    lifetime,
    revisionRate
  });
}
