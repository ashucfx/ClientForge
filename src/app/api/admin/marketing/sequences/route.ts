// src/app/api/admin/marketing/sequences/route.ts
// Automation hook: turn a predefined marketing sequence into a ready-to-send
// DRIP campaign. The existing cron (process-campaigns) then delivers each step
// automatically at its delay once the campaign is dispatched to an audience.
//   GET  -> list available sequences (with resolved step subjects)
//   POST { sequenceId } -> create a DRAFT DRIP FlywheelCampaign from that sequence

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { MARKETING_SEQUENCES, getSequenceById, getTemplateById } from '@/lib/marketing/templates';

export async function GET() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const sequences = MARKETING_SEQUENCES.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    steps: s.steps.map(st => {
      const t = getTemplateById(st.templateId);
      return { templateId: st.templateId, delayHours: st.delayHours, name: t?.name ?? st.templateId, subject: t?.subject ?? '' };
    }),
  }));
  return NextResponse.json({ success: true, sequences });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const seq = body?.sequenceId ? getSequenceById(String(body.sequenceId)) : null;
  if (!seq) return NextResponse.json({ success: false, error: 'Unknown sequence' }, { status: 400 });

  const steps = seq.steps
    .map(st => {
      const t = getTemplateById(st.templateId);
      if (!t) return null;
      return { subject: t.subject, contentHtml: t.bodyHtml, delayHours: st.delayHours };
    })
    .filter((s): s is { subject: string; contentHtml: string; delayHours: number } => s !== null);

  if (steps.length === 0) {
    return NextResponse.json({ success: false, error: 'Sequence has no valid templates' }, { status: 400 });
  }

  // Always scope to the admin's active tenant (never trust a client-supplied brand)
  const campaign = await db.flywheelCampaign.create({
    data: {
      name: seq.name,
      type: 'DRIP',
      brandId: session.activeTenant,
      status: 'DRAFT',
      metadata: { audienceFilter: 'ALL', sourceSequence: seq.id } as object,
      steps: {
        create: steps.map((s, i) => ({
          subject: s.subject,
          contentHtml: s.contentHtml,
          delayHours: s.delayHours,
          orderIndex: i,
        })),
      },
    },
    include: { steps: true },
  });

  return NextResponse.json({
    success: true,
    campaign,
    message: `Created "${seq.name}" as a draft drip campaign with ${steps.length} steps. Open it, choose an audience, and dispatch — the cron will send each step automatically.`,
  });
}
