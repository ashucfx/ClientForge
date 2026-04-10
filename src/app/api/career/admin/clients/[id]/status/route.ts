// src/app/api/career/admin/clients/[id]/status/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, EmailTrigger } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

const STATUS_EMAIL_MAP: Partial<Record<CareerStatus, EmailTrigger>> = {
  DRAFT_SENT:         'DRAFT_READY',
  REVISION_REQUESTED: 'REVISION',
  COMPLETED:          'FINAL_DELIVERY',
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newStatus = body?.status as CareerStatus | undefined;

  const validStatuses: CareerStatus[] = [
    'NOT_STARTED', 'SUBMITTED', 'UNDER_PROCESS',
    'DRAFT_SENT', 'REVISION_REQUESTED', 'COMPLETED',
  ];

  if (!newStatus || !validStatuses.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const client = await db.careerClient.update({
    where: { id: params.id },
    data: { status: newStatus },
    select: {
      id: true, name: true, email: true,
      packageType: true, status: true,
    },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'status_changed',
      performedBy: 'admin',
      metadata: { to: newStatus },
    },
  });

  // Trigger automatic email on certain status transitions
  const trigger = STATUS_EMAIL_MAP[newStatus];
  if (trigger) {
    const portalUrl = `${PORTAL_URL}/portal/dashboard`;

    // Get deliverables if needed for final delivery
    let files: { label: string; url: string }[] = [];
    if (trigger === 'FINAL_DELIVERY') {
      const deliverables = await db.careerDeliverable.findMany({
        where: { clientId: client.id },
        select: { label: true, fileUrl: true },
      });
      files = deliverables.map(d => ({ label: d.label, url: d.fileUrl }));

      // Send LinkedIn security email too if applicable
      if (['LINKEDIN', 'FULL'].includes(client.packageType)) {
        sendCareerEmail({ to: client.email, trigger: 'LINKEDIN_SECURITY', data: { name: client.name } })
          .catch(console.error);
      }
    }

    sendCareerEmail({
      to: client.email,
      trigger,
      data: {
        name: client.name,
        packageLabel: PACKAGE_LABELS[client.packageType],
        portalUrl,
        files,
      },
    }).then(async (resendId) => {
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger, resendId, status: 'sent' },
      });
    }).catch(async (err) => {
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger, status: 'failed', metadata: { error: String(err) } },
      });
    });
  }

  return NextResponse.json({
    ok: true,
    status: client.status,
    statusLabel: STATUS_LABELS[newStatus],
    emailTriggered: !!trigger,
  });
}
