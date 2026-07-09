import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET — CSV export of a campaign's enrolled leads with their engagement
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const campaign = await db.flywheelCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leads = await db.flywheelCampaignLead.findMany({
    where: { campaignId: params.id },
    include: { contact: { select: { name: true, email: true } } },
    take: 10000,
  });

  // Per-lead event counts
  const events = await db.flywheelEmailEvent.groupBy({
    by: ['campaignLeadId', 'eventType'],
    where: { campaignLead: { campaignId: params.id } },
    _count: { _all: true },
  }).catch(() => [] as { campaignLeadId: string; eventType: string; _count: { _all: number } }[]);

  const stat = new Map<string, { sent: number; opens: number; clicks: number }>();
  for (const e of events) {
    const s = stat.get(e.campaignLeadId) ?? { sent: 0, opens: 0, clicks: 0 };
    if (e.eventType === 'SENT') s.sent += e._count._all;
    else if (e.eventType === 'OPEN') s.opens += e._count._all;
    else if (e.eventType === 'CLICK') s.clicks += e._count._all;
    stat.set(e.campaignLeadId, s);
  }

  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Name', 'Email', 'Status', 'Emails Sent', 'Opens', 'Clicks'].join(','),
    ...leads.map(l => {
      const s = stat.get(l.id) ?? { sent: 0, opens: 0, clicks: 0 };
      return [esc(l.contact?.name ?? ''), esc(l.contact?.email ?? ''), esc(l.status), s.sent, s.opens, s.clicks].join(',');
    }),
  ].join('\n');

  const safeName = campaign.name.replace(/[^\w.-]+/g, '_').slice(0, 40);
  return new NextResponse(rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign_${safeName}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
