import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Use database aggregation to safely count SLAs without exhausting memory
  const careerSlaQuery = await db.$queryRaw`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN "completedAt" <= "slaDeadline" THEN 1 ELSE 0 END) as met,
      SUM(CASE WHEN "completedAt" > "slaDeadline" THEN 1 ELSE 0 END) as missed,
      SUM(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as totalDeliveryTimeMs
    FROM "CareerClient"
    WHERE "status" = 'COMPLETED' AND "slaDeadline" IS NOT NULL AND "completedAt" IS NOT NULL
  `;

  const rnSlaQuery = await db.$queryRaw`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN "completedAt" <= "slaDeadline" THEN 1 ELSE 0 END) as met,
      SUM(CASE WHEN "completedAt" > "slaDeadline" THEN 1 ELSE 0 END) as missed,
      SUM(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as totalDeliveryTimeMs
    FROM "RnClient"
    WHERE "currentStage" = 'LAUNCHED' AND "slaDeadline" IS NOT NULL AND "completedAt" IS NOT NULL
  `;

  const careerData = (careerSlaQuery as any[])[0] || { total: 0, met: 0, missed: 0, totalDeliveryTimeMs: 0 };
  const rnData = (rnSlaQuery as any[])[0] || { total: 0, met: 0, missed: 0, totalDeliveryTimeMs: 0 };

  const totalCompleted = Number(careerData.total || 0) + Number(rnData.total || 0);
  const slaMet = Number(careerData.met || 0) + Number(rnData.met || 0);
  const slaMissed = Number(careerData.missed || 0) + Number(rnData.missed || 0);
  const totalDeliveryTimeMs = Number(careerData.totalDeliveryTimeMs || 0) + Number(rnData.totalDeliveryTimeMs || 0);

  const slaMetPercentage = totalCompleted > 0 ? Math.round((slaMet / totalCompleted) * 100) : 100;
  const slaMissedPercentage = totalCompleted > 0 ? Math.round((slaMissed / totalCompleted) * 100) : 0;
  const averageDeliveryTimeDays = totalCompleted > 0 ? Math.round(totalDeliveryTimeMs / totalCompleted / (1000 * 60 * 60 * 24)) : 0;

  const totalCareerRevisions = await db.careerRevision.count();
  const totalRnRevisions = await db.rnRevision.count();
  const totalRevisions = totalCareerRevisions + totalRnRevisions;
  const revisionRate = totalCompleted > 0 ? Number((totalRevisions / totalCompleted).toFixed(1)) : 0;

  return NextResponse.json({
    lifetime: {
      totalCompleted,
      slaMetPercentage,
      slaMissedPercentage,
      averageDeliveryTimeDays,
      revisionRate,
      averageSlaDays: 14 // Placeholder or fetched from module configurations
    }
  });
}
