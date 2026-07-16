// src/app/api/rn/client/deliverables/[id]/approval/route.ts
// B2B client portal: approve a deliverable or request changes.
// Authenticated by the rn_client_session cookie (OTP login).

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { notifyAllAdmins } from '@/lib/notifications';
import { recordMessageSent } from '@/lib/communications';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as string;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : '';

  if (action !== 'approve' && action !== 'request_changes') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const deliverable = await db.rnDeliverable.findUnique({
    where: { id: params.id },
    include: { client: { select: { id: true, name: true, companyName: true } } },
  });
  // The deliverable must belong to the logged-in client — never accept IDs across accounts.
  if (!deliverable || deliverable.clientId !== session.clientId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const approvalStatus = action === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';

  const updated = await db.rnDeliverable.update({
    where: { id: deliverable.id },
    data: {
      approvalStatus,
      approvedAt: action === 'approve' ? new Date() : null,
    },
  });

  if (action === 'request_changes') {
    await db.rnRevision.create({
      data: {
        clientId: deliverable.clientId,
        requestedBy: 'client',
        note: note || `Changes requested on "${deliverable.label}"`,
        fileLabel: deliverable.label,
      },
    }).catch(() => {});
    // Revision requests start the admin SLA clock
    await recordMessageSent(deliverable.clientId, 'RN', 'client', 'REVISION_REQUEST').catch(() => {});
  }

  const clientName = deliverable.client.companyName || deliverable.client.name;
  await db.rnActivityLog.create({
    data: {
      clientId: deliverable.clientId,
      action: action === 'approve'
        ? `approved "${deliverable.label}"`
        : `requested changes on "${deliverable.label}"${note ? `: ${note.slice(0, 80)}` : ''}`,
      performedBy: deliverable.client.name,
    },
  }).catch(() => {});

  await notifyAllAdmins({
    title: action === 'approve' ? `✅ ${clientName} approved a deliverable` : `🔁 ${clientName} requested changes`,
    message: `"${deliverable.label}"${note ? ` — ${note.slice(0, 120)}` : ''}`,
    type: action === 'approve' ? 'SUCCESS' : 'WARNING',
    link: `/rn/projects/${deliverable.clientId}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, deliverable: updated });
}
