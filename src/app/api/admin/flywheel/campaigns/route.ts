import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Tenant isolation: SUPER_ADMIN may pass ?brandId override; everyone else sees their tenant only
    const url = new URL(req.url);
    const requestedBrand = url.searchParams.get('brandId') || session.activeTenant;
    const brandId = session.role === 'SUPER_ADMIN' ? requestedBrand : session.activeTenant;

    const campaigns = await db.flywheelCampaign.findMany({
      where: { brandId },
      include: {
        _count: { select: { leads: true } },
        steps: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate email event counts with a single SQL query instead of loading all events in JS
    const campaignIds = campaigns.map(c => c.id);
    const eventRows = campaignIds.length > 0
      ? await db.$queryRaw<{ campaignId: string; eventType: string; count: bigint }[]>`
          SELECT cl."campaignId", fe."eventType", COUNT(*) as count
          FROM "FlywheelEmailEvent" fe
          JOIN "FlywheelCampaignLead" cl ON cl.id = fe."campaignLeadId"
          WHERE cl."campaignId" = ANY(${campaignIds})
          GROUP BY cl."campaignId", fe."eventType"
        `
      : [];

    type StatsMap = Record<string, { sent: number; opens: number; clicks: number; unsubs: number }>;
    const statsMap: StatsMap = {};
    for (const row of eventRows) {
      if (!statsMap[row.campaignId]) statsMap[row.campaignId] = { sent: 0, opens: 0, clicks: 0, unsubs: 0 };
      const n = Number(row.count);
      if (row.eventType === 'SENT')        statsMap[row.campaignId].sent   += n;
      else if (row.eventType === 'OPEN')   statsMap[row.campaignId].opens  += n;
      else if (row.eventType === 'CLICK')  statsMap[row.campaignId].clicks += n;
      else if (row.eventType === 'UNSUBSCRIBE') statsMap[row.campaignId].unsubs += n;
    }

    const data = campaigns.map(c => {
      const s = statsMap[c.id] ?? { sent: 0, opens: 0, clicks: 0, unsubs: 0 };
      return {
        ...c,
        stats: { ...s, openRate: s.sent > 0 ? Math.round((s.opens / s.sent) * 100) : 0 },
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[FlywheelCampaigns] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, type = 'ONE_OFF', steps, metadata } = body;

    // Always scope campaign to the admin's active tenant — ignore any client-supplied brandId
    const brandId = session.activeTenant;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ success: false, error: 'Name and at least one step required' }, { status: 400 });
    }

    const campaign = await db.flywheelCampaign.create({
      data: {
        name,
        type,
        brandId,
        status: 'DRAFT',
        metadata: metadata ?? null,
        steps: {
          create: steps.map((s: any, i: number) => ({
            subject: s.subject,
            contentHtml: s.contentHtml,
            delayHours: s.delayHours || 0,
            orderIndex: i,
          })),
        },
      },
      include: { steps: true },
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    console.error('[FlywheelCampaigns] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
