// src/app/api/career/admin/clients/[id]/email/route.ts
// Manual email trigger by admin

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { PACKAGE_LABELS, SERVICE_LABELS } from '@/lib/career/types';
import type { EmailTrigger, CareerPackage, CareerServiceSlug } from '@/lib/career/types';

const LINKEDIN_FILE_TYPES = new Set([
  'linkedin_banner', 'linkedin_profile_picture', 'linkedin_optimization', 'linkedin_content', 'linkedin_playbook'
]);

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

/** Returns true if client has LinkedIn service */
function hasLinkedIn(client: {
  packageType: string | null;
  services: { service: { slug: string } }[];
}): boolean {
  if (client.services.length > 0) {
    return client.services.some(s => ['LINKEDIN', 'FULL_PACKAGE'].includes(s.service.slug));
  }
  return ['LINKEDIN', 'FULL'].includes(client.packageType ?? '');
}

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');
const VALID_TRIGGERS: EmailTrigger[] = [
  'WELCOME', 'REENGAGEMENT', 'FORM_CONFIRM', 'DRAFT_READY', 'LINKEDIN_DRAFT', 'REVISED_DRAFT',
  'REVISION', 'FINAL_DELIVERY', 'LINKEDIN_SECURITY',
];

const DRAFT_TRIGGERS = new Set<EmailTrigger>(['DRAFT_READY', 'LINKEDIN_DRAFT', 'REVISED_DRAFT']);

/** Map a specific file type to a natural document label for emails */
function fileTypeToEmailLabel(ft: string, fallback: string): string {
  const map: Record<string, string> = {
    resume:                       'Resume',
    cover_letter:                 'Cover Letter',
    linkedin_banner:              'LinkedIn Profile',
    linkedin_profile_picture:     'LinkedIn Profile',
    linkedin_optimization:        'LinkedIn Profile',
    linkedin_content:             'LinkedIn Profile',
    linkedin_playbook:            'LinkedIn Playbook',
    executive_profile_deep_audit: 'Executive Profile Deep Audit',
    portfolio:                    'Portfolio',
  };
  return map[ft] ?? fallback;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const trigger  = body?.trigger  as EmailTrigger | undefined;
  const fileType = body?.fileType as string | undefined; // optional — used for draft triggers

  if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    include: {
      deliverables: {
        orderBy: { createdAt: 'desc' },
        select: { label: true, fileUrl: true, fileType: true, fileCategory: true },
      },
      revisions: { where: { requestedBy: 'client' }, select: { id: true } },
      services: { select: { service: { select: { slug: true, name: true } } } },
      engagements: { orderBy: { sequence: 'desc' }, take: 1, select: { id: true, sequence: true, addedServices: true } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  let portalUrl = `${PORTAL_URL}/portal/dashboard`;

  if (trigger === 'WELCOME') {
    const [alreadyWelcomed, welcomeInFlight] = await Promise.all([
      db.careerEmailLog.findFirst({
        where: { clientId: client.id, trigger: 'WELCOME', status: 'sent' },
        select: { id: true },
      }),
      db.emailQueue.findFirst({
        where: { clientId: client.id, trigger: 'WELCOME', status: { in: ['PROCESSING', 'PENDING', 'SENT'] } },
        select: { id: true },
      }),
    ]);
    if (alreadyWelcomed || welcomeInFlight) {
      return NextResponse.json({ error: 'A welcome email was already sent. Use Re-engagement Email for a fresh link.' }, { status: 409 });
    }
  }

  // First-time welcome and explicit re-engagement both issue a fresh, single-use link.
  if (trigger === 'WELCOME' || trigger === 'REENGAGEMENT') {
    const magicToken  = generateMagicToken();
    const tokenExpiry = magicTokenExpiry();
    await db.careerClient.update({
      where: { id: client.id },
      data: { magicToken, magicTokenExpiry: tokenExpiry },
    });
    portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;
  }

  const revisionsLeft = Math.max(0, 2 - client.revisions.length);
  const overallLabel  = resolvePackageLabel(client);

  // For draft triggers: resolve specific document label from fileType (or auto-detect from latest draft)
  let packageLabel    = overallLabel;
  let effectiveTrigger: EmailTrigger = trigger;

  if (DRAFT_TRIGGERS.has(trigger)) {
    const resolvedFileType =
      fileType ??
      client.deliverables.find(d => d.fileCategory === 'draft')?.fileType;
    if (resolvedFileType) {
      packageLabel = fileTypeToEmailLabel(resolvedFileType, overallLabel);
      // Auto-upgrade DRAFT_READY → LINKEDIN_DRAFT for LinkedIn file types (better template)
      if (trigger === 'DRAFT_READY' && LINKEDIN_FILE_TYPES.has(resolvedFileType)) {
        effectiveTrigger = 'LINKEDIN_DRAFT';
      }
    }
  }

  const resendId = await sendCareerEmail({
    to: client.email,
    trigger: effectiveTrigger,
    clientId: client.id,
    ...(effectiveTrigger === 'REENGAGEMENT' && {
      logMetadata: {
        engagementId: client.engagements[0]?.id ?? null,
        engagementSequence: client.engagements[0]?.sequence ?? 1,
      },
    }),
    data: {
      name: client.name,
      packageLabel,
      portalUrl,
      files: client.deliverables.filter(d => d.fileCategory === 'final').map(({ label, fileUrl }) => ({ label, url: fileUrl })),
      revisionsLeft,
      ...(effectiveTrigger === 'REENGAGEMENT' && {
        engagementSequence: client.engagements[0]?.sequence ?? 1,
        addedServices: Array.isArray(client.engagements[0]?.addedServices)
          ? (client.engagements[0]?.addedServices as { slug?: string; name?: string }[]).map(service => service.name ?? service.slug ?? '').filter(Boolean)
          : [],
      }),
    },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'email_sent_manual',
      performedBy: 'admin',
      metadata: { trigger, queueId: resendId },
    },
  }).catch(err => console.error('[career/email] Could not record manual email activity:', err));

  return NextResponse.json({ ok: true, resendId, queued: true });
}
