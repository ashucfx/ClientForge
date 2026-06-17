import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Funnel — lifecycle stage counts
    const funnelRaw = await db.flywheelProfile.groupBy({
      by: ['lifecycleStage'],
      _count: { id: true },
    });
    const funnel: Record<string, number> = {};
    for (const row of funnelRaw) {
      funnel[row.lifecycleStage] = row._count.id;
    }

    // 2. Conversion rates between adjacent stages (toCount / fromCount = stage-to-next rate)
    const stages = ['SUBSCRIBER', 'LEAD', 'MQL', 'SQL', 'CUSTOMER'];
    const conversions: { from: string; to: string; rate: number }[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const fromCount = funnel[stages[i]] || 0;
      const toCount = funnel[stages[i + 1]] || 0;
      if (fromCount > 0 || toCount > 0) {
        conversions.push({
          from: stages[i],
          to: stages[i + 1],
          rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0
        });
      }
    }

    // 3. Campaign performance — all campaigns with event aggregation
    const campaigns = await db.flywheelCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { leads: true } },
      }
    });

    // Get event counts per campaign
    const campaignIds = campaigns.map(c => c.id);
    const eventCounts = await db.flywheelEmailEvent.groupBy({
      by: ['eventType'],
      where: {
        campaignLead: {
          campaignId: { in: campaignIds }
        }
      },
      _count: { id: true }
    });

    // Per-campaign stats
    const campaignStatsRaw = campaignIds.length > 0
      ? await db.$queryRaw`
          SELECT cl."campaignId",
                 ee."eventType",
                 COUNT(ee.id)::int as count
          FROM "FlywheelCampaignLead" cl
          JOIN "FlywheelEmailEvent" ee ON ee."campaignLeadId" = cl.id
          WHERE cl."campaignId" = ANY(${campaignIds})
          GROUP BY cl."campaignId", ee."eventType"
        ` as Array<{ campaignId: string; eventType: string; count: number }>
      : [];

    const campaignStatsMap: Record<string, Record<string, number>> = {};
    for (const row of campaignStatsRaw) {
      if (!campaignStatsMap[row.campaignId]) campaignStatsMap[row.campaignId] = {};
      campaignStatsMap[row.campaignId][row.eventType] = row.count;
    }

    const campaignPerformance = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      type: c.type,
      audience: c._count.leads,
      sent: campaignStatsMap[c.id]?.SENT || 0,
      opens: campaignStatsMap[c.id]?.OPEN || 0,
      clicks: campaignStatsMap[c.id]?.CLICK || 0,
      unsubs: campaignStatsMap[c.id]?.UNSUBSCRIBE || 0,
      openRate: (campaignStatsMap[c.id]?.SENT || 0) > 0
        ? Math.round(((campaignStatsMap[c.id]?.OPEN || 0) / (campaignStatsMap[c.id]?.SENT || 0)) * 100) : 0,
      createdAt: c.createdAt,
    }));

    // 4. Lead source distribution
    const sourceRaw = await db.contact.groupBy({
      by: ['contactSource'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
    });
    const leadSources: Record<string, number> = {};
    for (const row of sourceRaw) {
      leadSources[row.contactSource || 'UNKNOWN'] = row._count.id;
    }

    // 5. Top contacts by engagement
    const topContacts = await db.flywheelProfile.findMany({
      take: 10,
      orderBy: { engagementScore: 'desc' },
      where: { engagementScore: { gt: 0 } },
      include: { contact: { select: { name: true, email: true, companyName: true } } }
    });

    // 6. Overall email performance
    const totalSent = eventCounts.find(e => e.eventType === 'SENT')?._count?.id || 0;
    const totalOpens = eventCounts.find(e => e.eventType === 'OPEN')?._count?.id || 0;
    const totalClicks = eventCounts.find(e => e.eventType === 'CLICK')?._count?.id || 0;
    const totalUnsubs = eventCounts.find(e => e.eventType === 'UNSUBSCRIBE')?._count?.id || 0;

    // 7. Revenue by stage — read from denorm field (kept in sync by syncContactRevenue after each payment)
    const revenueByStageRaw = await db.flywheelProfile.groupBy({
      by: ['lifecycleStage'],
      _sum: { totalRevenue: true },
      where: { totalRevenue: { gt: 0 } },
    });
    const revenueStages: Record<string, number> = {};
    for (const row of revenueByStageRaw) {
      revenueStages[row.lifecycleStage] = Number(row._sum.totalRevenue || 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        funnel,
        conversions,
        campaignPerformance,
        leadSources,
        topContacts: topContacts.map(tc => ({
          id: tc.id,
          name: tc.contact.name,
          email: tc.contact.email,
          company: tc.contact.companyName,
          engagementScore: tc.engagementScore,
          totalRevenue: Number(tc.totalRevenue),
          lifecycleStage: tc.lifecycleStage,
        })),
        emailPerformance: { totalSent, totalOpens, totalClicks, totalUnsubs, openRate: totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0, clickRate: totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0 },
        revenueByStage: revenueStages,
      }
    });
  } catch (error) {
    console.error('[FlywheelAnalyticsOverview] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
