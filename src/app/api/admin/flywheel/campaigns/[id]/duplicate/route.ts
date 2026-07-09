import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// POST — clone a campaign (and its steps) as a fresh DRAFT
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const source = await db.flywheelCampaign.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!source) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && source.brandId !== session.activeTenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const copy = await db.flywheelCampaign.create({
    data: {
      name: `${source.name} (copy)`,
      type: source.type,
      brandId: source.brandId,
      status: 'DRAFT',
      metadata: (source.metadata ?? undefined) as object | undefined,
      steps: {
        create: source.steps.map(s => ({
          subject: s.subject,
          contentHtml: s.contentHtml,
          delayHours: s.delayHours,
          orderIndex: s.orderIndex,
        })),
      },
    },
    include: { steps: true },
  });

  return NextResponse.json({ success: true, data: copy });
}
