// src/app/api/career/admin/clients/[id]/status/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS, SERVICE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, CareerPackage, CareerServiceSlug, EmailTrigger } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

/** Derive the correct service label — always reads from SERVICE_LABELS so DB names can't override */
function resolvePackageLabel(client: {
  packageType: string | null;
  services: { service: { slug: string; name: string } }[];
}): string {
  if (client.services.length > 0) {
    return client.services
      .map(s => SERVICE_LABELS[s.service.slug as CareerServiceSlug] ?? s.service.name)
      .join(', ');
  }
  if (client.packageType) {
    return PACKAGE_LABELS[client.packageType as CareerPackage] ?? client.packageType;
  }
  return 'Career Services';
}

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newStatus = body?.status as CareerStatus | undefined;

  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Confirmation is enforced on the frontend; backend just validates and updates
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

  // Determine which email to send: DRAFT_SENT is service-aware, rest are static
  const trigger: EmailTrigger | undefined =
    newStatus === 'DRAFT_SENT'
      ? resolveDraftTrigger(client)
      : STATIC_EMAIL_MAP[newStatus];

  if (trigger) {
    const portalUrl = `${PORTAL_URL}/portal/dashboard`;
    let files: { label: string; url: string }[] = [];

    if (trigger === 'FINAL_DELIVERY') {
      const deliverables = await db.careerDeliverable.findMany({
        where: { clientId: client.id, fileCategory: 'final' },
        select: { label: true, fileUrl: true },
      });
      files = deliverables.map(d => ({ label: d.label, url: d.fileUrl }));

      // Always send LinkedIn security steps alongside final delivery for LinkedIn clients
      if (hasLinkedInService) {
        sendCareerEmail({
          to: client.email,
          trigger: 'LINKEDIN_SECURITY',
          data: { name: client.name },
        }).catch(console.error);
      }
    }

    sendCareerEmail({
      to: client.email,
      trigger,
      clientId: client.id,
      data: { name: client.name, packageLabel: serviceLabel, portalUrl, files },
    }).catch(async (err) => {
      console.error('[status PATCH] Email failed:', err);
    });
  }

  return NextResponse.json({
    ok: true,
    status: client.status,
    statusLabel: STATUS_LABELS[newStatus],
    emailTriggered: !!trigger,
    emailTrigger: trigger ?? null,
  });
}
