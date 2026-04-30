// src/app/api/career/admin/clients/[id]/status/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, EmailTrigger } from '@/lib/career/types';
import { PORTAL_URL } from '@/lib/config';
import { resolvePackageLabel } from '@/lib/career/utils';

/** Choose which draft email to send based on the client's services */
function resolveDraftTrigger(client: {
  packageType: string | null;
  services: { service: { slug: string } }[];
}): EmailTrigger {
  const slugs = client.services.map(s => s.service.slug);
  // LinkedIn-only: send the LinkedIn-specific draft email
  const isLinkedInOnly =
    slugs.length > 0
      ? slugs.every(s => s === 'LINKEDIN')
      : client.packageType === 'LINKEDIN';
  return isLinkedInOnly ? 'LINKEDIN_DRAFT' : 'DRAFT_READY';
}

const STATIC_EMAIL_MAP: Partial<Record<CareerStatus, EmailTrigger>> = {
  REVISION_REQUESTED: 'REVISION',
  COMPLETED:          'FINAL_DELIVERY',
};

const VALID_STATUSES: CareerStatus[] = [
  'NOT_STARTED', 'SUBMITTED', 'UNDER_PROCESS',
  'DRAFT_SENT', 'REVISION_REQUESTED', 'COMPLETED',
];

// Allowed forward and backward transitions — prevents arbitrary status jumps
const ALLOWED_TRANSITIONS: Record<CareerStatus, CareerStatus[]> = {
  NOT_STARTED:        ['SUBMITTED', 'UNDER_PROCESS'],
  SUBMITTED:          ['NOT_STARTED', 'UNDER_PROCESS'],
  UNDER_PROCESS:      ['SUBMITTED', 'DRAFT_SENT', 'COMPLETED'],
  DRAFT_SENT:         ['UNDER_PROCESS', 'REVISION_REQUESTED', 'COMPLETED'],
  REVISION_REQUESTED: ['UNDER_PROCESS', 'DRAFT_SENT'],
  COMPLETED:          ['NOT_STARTED', 'SUBMITTED', 'UNDER_PROCESS', 'DRAFT_SENT', 'REVISION_REQUESTED'],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newStatus = body?.status as CareerStatus | undefined;
  const force     = body?.force === true; // admin override for exceptional cases

  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Fetch current status for transition validation
  const existing = await db.careerClient.findUnique({
    where:  { id: params.id },
    select: { status: true },
  });
  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!force && !allowed.includes(newStatus)) {
    return NextResponse.json({
      error: `Cannot transition from ${existing.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}. Pass force:true to override.`,
    }, { status: 422 });
  }

  const client = await db.careerClient.update({
    where: { id: params.id },
    data: { status: newStatus },
    select: {
      id: true, name: true, email: true,
      packageType: true, status: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
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

  const serviceLabel = resolvePackageLabel(client);
  const hasLinkedInService =
    client.services.some(s => ['LINKEDIN', 'FULL_PACKAGE'].includes(s.service.slug)) ||
    ['LINKEDIN', 'FULL'].includes(client.packageType ?? '');
  const portalUrl = `${PORTAL_URL}/portal/dashboard`;

  // Determine which email to send: DRAFT_SENT is service-aware, rest are static
  const trigger: EmailTrigger | undefined =
    newStatus === 'DRAFT_SENT'
      ? resolveDraftTrigger(client)
      : STATIC_EMAIL_MAP[newStatus];

  const emailTriggersToSend: { trigger: EmailTrigger; data: Record<string, unknown> }[] = [];

  if (trigger) {
    let files: { label: string; url: string }[] = [];

    if (trigger === 'FINAL_DELIVERY') {
      const deliverables = await db.careerDeliverable.findMany({
        where: { clientId: client.id, fileCategory: 'final' },
        select: { label: true, fileUrl: true },
      });
      files = deliverables.map(d => ({ label: d.label, url: d.fileUrl }));

      const alreadySentFinal = await db.careerEmailLog.findFirst({
        where: { clientId: client.id, trigger: 'FINAL_DELIVERY', status: 'sent' },
      });

      if (!alreadySentFinal) {
        emailTriggersToSend.push({
          trigger,
          data: { name: client.name, packageLabel: serviceLabel, portalUrl, files },
        });
      }

      // Always send LinkedIn security steps alongside final delivery for LinkedIn clients,
      // but only once per client.
      if (hasLinkedInService) {
        const alreadySentLinkedInSecurity = await db.careerEmailLog.findFirst({
          where: { clientId: client.id, trigger: 'LINKEDIN_SECURITY', status: 'sent' },
        });

        if (!alreadySentLinkedInSecurity) {
          emailTriggersToSend.push({
            trigger: 'LINKEDIN_SECURITY',
            data: { name: client.name },
          });
        }
      }
    } else {
      emailTriggersToSend.push({
        trigger,
        data: { name: client.name, packageLabel: serviceLabel, portalUrl, files },
      });
    }

    for (const item of emailTriggersToSend) {
      sendCareerEmail({
        to: client.email,
        trigger: item.trigger,
        clientId: client.id,
        data: item.data,
      }).catch((err) => {
        console.error('[status PATCH] Email failed:', err);
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: client.status,
    statusLabel: STATUS_LABELS[newStatus],
    emailTriggered: emailTriggersToSend.length > 0,
    emailTrigger: emailTriggersToSend[0]?.trigger ?? null,
  });
}
