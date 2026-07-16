// src/app/api/rn/projects/[id]/route.ts
// PATCH — edit project details (delivery date, budget, notes, waiting-on)
//         or archive/restore via { lifecycleStatus }.

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { logAudit } from '@/lib/audit/logger';

export const runtime = 'nodejs';

const LIFECYCLES = new Set(['ACTIVE', 'ARCHIVED', 'CANCELLED']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const existing = await db.rnClient.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const data: Record<string, any> = {};
  const changes: string[] = [];

  if (body.expectedDeliveryAt !== undefined) {
    data.expectedDeliveryAt = body.expectedDeliveryAt ? new Date(body.expectedDeliveryAt) : null;
    changes.push('delivery date');
  }
  if (body.amountPaid !== undefined) {
    const amount = Number(body.amountPaid);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    data.amountPaid = amount;
    changes.push('budget');
  }
  if (typeof body.notes === 'string') {
    data.notes = body.notes.slice(0, 4000);
    changes.push('notes');
  }
  if (typeof body.companyName === 'string') {
    data.companyName = body.companyName.slice(0, 200) || null;
    changes.push('company');
  }
  if (typeof body.clientName === 'string' && body.clientName.trim()) {
    data.name = body.clientName.trim().slice(0, 200);
    changes.push('client name');
  }
  if (typeof body.email === 'string' && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (email !== existing.email) {
      const taken = await db.rnClient.findFirst({ where: { email, id: { not: params.id } }, select: { id: true } });
      if (taken) {
        return NextResponse.json({ error: 'Another client already uses that email' }, { status: 400 });
      }
      data.email = email;
      changes.push('email');
    }
  }
  if (body.waitingOn === 'AGENCY' || body.waitingOn === 'CLIENT') {
    data.waitingOn = body.waitingOn;
    changes.push('waiting-on');
  }
  if (typeof body.lifecycleStatus === 'string' && LIFECYCLES.has(body.lifecycleStatus)) {
    data.lifecycleStatus = body.lifecycleStatus;
    data.archivedAt = body.lifecycleStatus === 'ACTIVE' ? null : new Date();
    if (typeof body.archiveReason === 'string') data.archiveReason = body.archiveReason.slice(0, 500);
    changes.push(body.lifecycleStatus === 'ACTIVE' ? 'restored' : 'archived');
  }
  if (body.markCompleted === true) {
    data.currentStage = 'COMPLETED';
    data.completedAt = new Date();
    changes.push('completed');
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await db.rnClient.update({ where: { id: params.id }, data });

  await db.rnActivityLog.create({
    data: {
      clientId: params.id,
      action: `updated project (${changes.join(', ')})`,
      performedBy: 'Admin',
    },
  }).catch(() => {});

  await logAudit(
    { tenantId: 'ripple_nexus', adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
    'PROJECT_UPDATED',
    'RnClient',
    params.id,
    { after: data }
  );

  return NextResponse.json({ project: updated });
}
