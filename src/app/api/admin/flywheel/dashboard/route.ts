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

    // 1. Funnel: Contacts grouped by lifecycle stage
    const funnelRaw = await db.flywheelProfile.groupBy({
      by: ['lifecycleStage'],
      _count: { id: true },
    });
    const funnel: Record<string, number> = {};
    for (const row of funnelRaw) {
      funnel[row.lifecycleStage] = row._count.id;
    }

    // 2. Total contacts
    const totalContacts = await db.contact.count({ where: { status: 'ACTIVE' } });

    // 3. Pipeline value (sum of totalRevenue from profiles of active leads)
    const pipelineValueRaw = await db.flywheelProfile.aggregate({
      _sum: { totalRevenue: true },
      where: { lifecycleStage: { in: ['LEAD', 'MQL', 'SQL'] } },
    });
    const pipelineValue = Number(pipelineValueRaw._sum.totalRevenue || 0);

    // 4. Active campaigns
    const activeCampaigns = await db.flywheelCampaign.count({ where: { status: 'ACTIVE' } });
    const totalCampaigns = await db.flywheelCampaign.count();

    // 5. Conversion rate: Leads who became customers
    const totalLeads = await db.flywheelProfile.count();
    const totalCustomers = await db.flywheelProfile.count({ where: { lifecycleStage: 'CUSTOMER' } });
    const conversionRate = totalLeads > 0 ? Math.round((totalCustomers / totalLeads) * 100) : 0;

    // 6. Campaign performance summary — top 5 most recent active/completed
    const campaigns = await db.flywheelCampaign.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { leads: true } },
        leads: {
          select: {
            events: {
              select: { eventType: true }
            }
          }
        }
      }
    });

    const campaignStats = campaigns.map(c => {
      let sent = 0, opens = 0, unsubs = 0;
      for (const lead of c.leads) {
        for (const ev of lead.events) {
          if (ev.eventType === 'SENT') sent++;
          else if (ev.eventType === 'OPEN') opens++;
          else if (ev.eventType === 'UNSUBSCRIBE') unsubs++;
        }
      }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        type: c.type,
        audienceSize: c._count.leads,
        sent,
        opens,
        unsubs,
        openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
        createdAt: c.createdAt,
      };
    });

    // 7. Recent activity feed — last 15 email events
    const recentEvents = await db.flywheelEmailEvent.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        campaignLead: {
          include: {
            contact: { select: { name: true, email: true } },
            campaign: { select: { name: true } }
          }
        }
      }
    });

    const activityFeed = recentEvents.map(ev => ({
      id: ev.id,
      eventType: ev.eventType,
      contactName: ev.campaignLead.contact.name,
      contactEmail: ev.campaignLead.contact.email,
      campaignName: ev.campaignLead.campaign.name,
      createdAt: ev.createdAt,
    }));

    // 8. Lead source distribution
    const sourceRaw = await db.contact.groupBy({
      by: ['contactSource'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
    });
    const leadSources: Record<string, number> = {};
    for (const row of sourceRaw) {
      leadSources[row.contactSource || 'UNKNOWN'] = row._count.id;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalContacts,
        pipelineValue,
        activeCampaigns,
        totalCampaigns,
        conversionRate,
        totalCustomers,
        funnel,
        campaignStats,
        activityFeed,
        leadSources,
      }
    });
  } catch (error) {
    console.error('[FlywheelDashboard] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
