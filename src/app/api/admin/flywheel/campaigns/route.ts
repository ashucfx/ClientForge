import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId') || 'catalyst';

    const campaigns = await db.flywheelCampaign.findMany({
      where: { brandId },
      include: {
        _count: { select: { leads: true } },
        steps: { orderBy: { orderIndex: 'asc' } },
        leads: { select: { events: { select: { eventType: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = campaigns.map(c => {
      let sent = 0, opens = 0, clicks = 0, unsubs = 0;
      for (const lead of c.leads) {
        for (const ev of lead.events) {
          if (ev.eventType === 'SENT') sent++;
          else if (ev.eventType === 'OPEN') opens++;
          else if (ev.eventType === 'CLICK') clicks++;
          else if (ev.eventType === 'UNSUBSCRIBE') unsubs++;
        }
      }
      const { leads: _leads, ...rest } = c;
      return { ...rest, stats: { sent, opens, clicks, unsubs, openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0 } };
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
    const { name, type = 'ONE_OFF', brandId = 'catalyst', steps } = body;

    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ success: false, error: 'Name and at least one step required' }, { status: 400 });
    }

    // Create Campaign and Steps in a transaction
    const campaign = await db.flywheelCampaign.create({
      data: {
        name,
        type,
        brandId,
        status: 'DRAFT',
        steps: {
          create: steps.map((s: any, i: number) => ({
            subject: s.subject,
            contentHtml: s.contentHtml,
            delayHours: s.delayHours || 0,
            orderIndex: i
          }))
        }
      },
      include: { steps: true }
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    console.error('[FlywheelCampaigns] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
