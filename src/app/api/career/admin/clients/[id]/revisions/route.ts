// src/app/api/career/admin/clients/[id]/revisions/route.ts
// Admin can GET all revisions, POST a new one, and PATCH status (approve/deny)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS, SERVICE_LABELS } from '@/lib/career/types';
import type { CareerPackage, CareerServiceSlug } from '@/lib/career/types';
import { waitUntil } from '@vercel/functions';


const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

/** Derive a human-readable service label for a client (services → packageType → fallback) */
function clientServiceLabel(client: {
  packageType: string | null;
  services: { service: { name: string } }[];
}): string {
  if (client.services.length > 0) return client.services.map(s => s.service.name).join(', ');
  if (client.packageType) return PACKAGE_LABELS[client.packageType as CareerPackage] ?? client.packageType;
  return 'Career Services';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { services: { select: { service: { select: { slug: true, name: true } } } } }
  });

  const revisions = await db.careerRevision.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  const FREE_LIMIT = 2;
  const services = client?.services ?? [];
  const serviceSlugs = new Set(services.map(s => s.service.slug));
  const isSingle = services.length === 1;
  const clientRevisions = revisions.filter(r => r.requestedBy === 'client');

  // GENERAL revisions = legacy slugs not mapped to any actual service
  const generalFreeUsed = clientRevisions.filter(
    r => r.chargeStatus === 'FREE' && (!r.serviceSlug || r.serviceSlug === 'GENERAL' || !serviceSlugs.has(r.serviceSlug))
  ).length;

  const revisionSummary = services.map((s, idx) => {
    const slug = s.service.slug;
    const slugFreeUsed = clientRevisions.filter(r => r.serviceSlug === slug && r.chargeStatus === 'FREE').length;
    // Attribute GENERAL to primary service (same logic as portal /me)
    const freeUsed = isSingle
      ? slugFreeUsed + generalFreeUsed
      : idx === 0 ? slugFreeUsed + generalFreeUsed : slugFreeUsed;
    const paidUsed = clientRevisions.filter(r => r.serviceSlug === slug && r.chargeStatus !== 'FREE').length;
    return {
      slug,
      name: SERVICE_LABELS[slug as CareerServiceSlug] ?? s.service.name,
      freeLimit: FREE_LIMIT,
      freeUsed,
      revisionsLeft: Math.max(0, FREE_LIMIT - freeUsed),
      paidUsed,
    };
  });

  return NextResponse.json({ revisions, revisionSummary });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const note            = (body?.note as string | undefined)?.trim();
  const fileLabel       = (body?.fileLabel as string | undefined)?.trim() || undefined;
  const serviceSlug     = (body?.serviceSlug as string | undefined)?.trim() || undefined;
  const doSendEmail     = body?.sendEmail !== false; // default true
  // Set to true when client requested via chat/call — counts against their free limit
  const countAsClient   = body?.countAsClient === true;

  if (!note || note.length < 5) {
    return NextResponse.json({ error: 'Note required (min 5 chars).' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, packageType: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const currentClient = await db.careerClient.findUnique({
    where: { id: client.id }, select: { status: true },
  });

  // If counting as client, enforce the same 2-revision limit to prevent chat-bypass
  if (countAsClient && serviceSlug) {
    const FREE_LIMIT = 2;
    const serviceSlugs = client.services.map(s => s.service.slug);
    const isSingle = serviceSlugs.length <= 1;
    const existing = await db.careerRevision.count({
      where: {
        clientId: client.id,
        requestedBy: 'client',
        chargeStatus: 'FREE',
        serviceSlug: isSingle ? { in: [serviceSlug, 'GENERAL'] } : serviceSlug,
      },
    });
    if (existing >= FREE_LIMIT) {
      return NextResponse.json({
        error: `Client has already used all ${FREE_LIMIT} free revisions for this service.`,
        limitExceeded: true,
      }, { status: 422 });
    }
  }

  const revision = await db.careerRevision.create({
    data: {
      clientId: client.id,
      requestedBy: countAsClient ? 'client' : 'admin',
      note,
      fileLabel,
      serviceSlug,
      status: 'PENDING',
      chargeStatus: 'FREE',
      clientStatusBefore: currentClient?.status ?? null,
    },
  });

  // Auto-set client to REVISION_REQUESTED so the admin dashboard reflects it
  if (['DRAFT_SENT', 'COMPLETED', 'UNDER_PROCESS'].includes(currentClient?.status ?? '')) {
    await db.careerClient.update({
      where: { id: client.id },
      data: { status: 'REVISION_REQUESTED' },
    });
  }

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'revision_created_by_admin',
      performedBy: 'admin',
      metadata: { note: note.slice(0, 100), fileLabel },
    },
  });

  if (doSendEmail) {
    waitUntil(
      sendCareerEmail({
        to: client.email,
        trigger: 'REVISION',
        data: {
          name: client.name,
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          packageLabel: clientServiceLabel(client),
          revisionStatus: 'approved',
        },
      }).catch(err => console.error('[admin/revisions POST] Email failed:', err))
    );
  }

  return NextResponse.json({ ok: true, revision }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const revisionId   = body?.revisionId as string | undefined;
  const status       = body?.status as string | undefined;
  const adminNote    = (body?.adminNote as string | undefined)?.trim() || undefined;
  const doSendEmail  = body?.sendEmail !== false; // default true

  if (!revisionId || !['APPROVED', 'DENIED', 'PENDING'].includes(status ?? '')) {
    return NextResponse.json({ error: 'revisionId and valid status required' }, { status: 400 });
  }

  const revision = await db.careerRevision.update({
    where: { id: revisionId, clientId: params.id },
    data: { status: status!, adminNote },
    select: {
      id: true, status: true, adminNote: true,
      clientStatusBefore: true, chargeStatus: true,
      serviceSlug: true, note: true, requestedBy: true, createdAt: true, updatedAt: true,
      fileLabel: true, invoiceId: true,
    },
  });

  // Sync client status based on revision decision
  if (status === 'APPROVED') {
    // Admin is about to start work → UNDER_PROCESS
    await db.careerClient.update({
      where: { id: params.id },
      data: { status: 'UNDER_PROCESS' },
    });
  } else if (status === 'DENIED') {
    // Only revert if no other active (PENDING or APPROVED) revisions remain
    const otherActive = await db.careerRevision.count({
      where: {
        clientId: params.id,
        id: { not: revisionId },
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (otherActive === 0) {
      const current = await db.careerClient.findUnique({
        where: { id: params.id }, select: { status: true },
      });
      // Restore exact state the client was in before the revision was requested
      const beforeStatus = revision.clientStatusBefore;
      const isBlockedStatus = current?.status === 'REVISION_REQUESTED' || current?.status === 'UNDER_PROCESS';
      if (isBlockedStatus) {
        // Use stored prior state; fall back to DRAFT_SENT if unknown
        const restoreTo = (beforeStatus === 'COMPLETED' || beforeStatus === 'DRAFT_SENT')
          ? beforeStatus
          : 'DRAFT_SENT';
        await db.careerClient.update({
          where: { id: params.id },
          data: { status: restoreTo },
        });
      }
    }
  }

  await db.careerActivityLog.create({
    data: {
      clientId: params.id,
      action: `revision_${status!.toLowerCase()}`,
      performedBy: 'admin',
      metadata: { revisionId, adminNote },
    },
  });

  // Send email to client on approve or deny (only if requested, not on PENDING reset)
  if (doSendEmail && (status === 'APPROVED' || status === 'DENIED')) {
    const client = await db.careerClient.findUnique({
      where: { id: params.id },
      select: {
        name: true, email: true, packageType: true,
        services: { select: { service: { select: { slug: true, name: true } } } },
      },
    });

    if (client) {
      waitUntil(
        sendCareerEmail({
          to: client.email,
          trigger: 'REVISION',
          data: {
            name: client.name,
            portalUrl: `${PORTAL_URL}/portal/dashboard`,
            packageLabel: clientServiceLabel(client),
            revisionStatus: status === 'APPROVED' ? 'approved' : 'denied',
          },
        }).catch(err => console.error('[admin/revisions PATCH] Email failed:', err))
      );
    }
  }

  return NextResponse.json({ ok: true, revision });
}
