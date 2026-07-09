import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

async function authorize(campaignId: string) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) return null;

  // Tenant isolation: verify the campaign belongs to this admin's active tenant
  const campaign = await db.flywheelCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) return null;

  return { session, campaign };
}

// GET — full detail: steps + per-step stats + enrolled count
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  const steps = await db.flywheelCampaignStep.findMany({
    where: { campaignId: params.id },
    orderBy: { orderIndex: 'asc' },
  });

  // Per-step event counts (sent/opens/clicks) via the lead's current step is
  // approximate; instead we count events joined to their step through the lead.
  const stepStatRows = await db.$queryRaw<{ stepId: string; eventType: string; count: bigint }[]>`
    SELECT cl."currentStepId" as "stepId", fe."eventType", COUNT(*) as count
    FROM "FlywheelEmailEvent" fe
    JOIN "FlywheelCampaignLead" cl ON cl.id = fe."campaignLeadId"
    WHERE cl."campaignId" = ${params.id}
    GROUP BY cl."currentStepId", fe."eventType"
  `.catch(() => []);

  const enrolled = await db.flywheelCampaignLead.count({ where: { campaignId: params.id } });

  return NextResponse.json({ success: true, campaign: auth.campaign, steps, stepStats: stepStatRows.map(r => ({ ...r, count: Number(r.count) })), enrolled });
}

// PATCH — status change (pause/resume) OR content edit (name / steps / metadata)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // 1) Status-only update
  if (body.status && body.name === undefined && body.steps === undefined && body.metadata === undefined) {
    const allowed = ['ACTIVE', 'PAUSED', 'DRAFT'];
    if (!allowed.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const campaign = await db.flywheelCampaign.update({ where: { id: params.id }, data: { status: body.status } });
    return NextResponse.json({ success: true, data: campaign });
  }

  // 2) Content edit
  try {
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.metadata !== undefined) data.metadata = body.metadata;
    if (Object.keys(data).length > 0) {
      await db.flywheelCampaign.update({ where: { id: params.id }, data });
    }

    if (Array.isArray(body.steps) && body.steps.length > 0) {
      const incoming = body.steps.map((s: any, i: number) => ({
        subject: String(s.subject ?? ''),
        contentHtml: String(s.contentHtml ?? ''),
        delayHours: i === 0 ? 0 : Math.max(1, Number(s.delayHours) || 24),
      }));

      if (auth.campaign.status === 'DRAFT') {
        // No enrolled leads on a draft — safe to replace the whole set
        await db.$transaction([
          db.flywheelCampaignStep.deleteMany({ where: { campaignId: params.id } }),
          db.flywheelCampaignStep.createMany({
            data: incoming.map((s: { subject: string; contentHtml: string; delayHours: number }, i: number) => ({ campaignId: params.id, ...s, orderIndex: i })),
          }),
        ]);
      } else {
        // Active/paused: only update content of EXISTING steps in place (by order),
        // never add/remove — that would break leads' currentStepId references.
        const existing = await db.flywheelCampaignStep.findMany({
          where: { campaignId: params.id }, orderBy: { orderIndex: 'asc' },
        });
        const n = Math.min(existing.length, incoming.length);
        await db.$transaction(
          Array.from({ length: n }, (_, i) =>
            db.flywheelCampaignStep.update({
              where: { id: existing[i].id },
              data: { subject: incoming[i].subject, contentHtml: incoming[i].contentHtml, delayHours: incoming[i].delayHours },
            })
          )
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Campaign PATCH edit] error:', e);
    return NextResponse.json({ error: 'Could not update campaign' }, { status: 500 });
  }
}

// DELETE — remove campaign and all associated leads/events (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

  try {
    await db.flywheelCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
}
