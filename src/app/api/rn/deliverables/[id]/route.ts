// src/app/api/rn/deliverables/[id]/route.ts
// PATCH  — admin sets approval status (PENDING / APPROVED / CHANGES_REQUESTED)
// DELETE — admin removes a deliverable

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { logAudit } from '@/lib/audit/logger';

export const runtime = 'nodejs';

const STATUSES = new Set(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const approvalStatus = body?.approvalStatus;
  if (!STATUSES.has(approvalStatus)) {
    return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 });
  }

  const deliverable = await db.rnDeliverable.findUnique({ where: { id: params.id } });
  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await db.rnDeliverable.update({
    where: { id: params.id },
    data: {
      approvalStatus,
      approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
    },
  });

  await db.rnActivityLog.create({
    data: {
      clientId: deliverable.clientId,
      action: `set "${deliverable.label}" to ${approvalStatus.replace(/_/g, ' ').toLowerCase()}`,
      performedBy: 'Admin',
    },
  }).catch(() => {});

  return NextResponse.json({ deliverable: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const deliverable = await db.rnDeliverable.findUnique({ where: { id: params.id } });
  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.rnDeliverable.delete({ where: { id: params.id } });

  await db.rnActivityLog.create({
    data: {
      clientId: deliverable.clientId,
      action: `removed deliverable "${deliverable.label}"`,
      performedBy: 'Admin',
    },
  }).catch(() => {});

  await logAudit(
    { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
    'DELIVERABLE_DELETED',
    'RnDeliverable',
    params.id,
    { before: deliverable }
  );

  return NextResponse.json({ ok: true });
}
