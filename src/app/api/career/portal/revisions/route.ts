// src/app/api/career/portal/revisions/route.ts
// Client can GET their revision requests and POST a new revision request

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { notifyAllAdmins } from '@/lib/notifications';
import { waitUntil } from '@vercel/functions';


const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';
const PORTAL_URL  =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

async function getClient() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      id: true, name: true, email: true, status: true, completedAt: true, lifecycleStatus: true,
      services: { select: { service: { select: { slug: true } } } },
    },
  });
  return client ?? null;
}

export async function GET() {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const revisions = await db.careerRevision.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest) {
  const client = await getClient();
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Enforce strict archival check
  if (client.lifecycleStatus === 'ARCHIVED') {
    return NextResponse.json({
      error: 'This project is archived. Revisions are no longer available. Please purchase a new engagement or upgrade.',
    }, { status: 403 });
  }

  // 15-day post-delivery window: after final delivery, only 15 days of free revisions
  if (client.status === 'COMPLETED' && client.completedAt) {
    const daysSinceDelivery = Math.floor((Date.now() - new Date(client.completedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 15) {
      return NextResponse.json({
        error: `The 15-day revision window has closed (delivered ${daysSinceDelivery} days ago). Please contact us to arrange a paid revision.`,
        windowExpired: true,
      }, { status: 403 });
    }
  }

  const body      = await req.json().catch(() => null);
  const note      = (body?.note as string | undefined)?.trim();
  const fileLabel = (body?.fileLabel as string | undefined)?.trim() || undefined;

  // Resolve service slug: prefer what the client sends, fall back to primary service, then GENERAL
  const serviceSlugs = client.services.map(s => s.service.slug);
  const rawSlug = (body?.serviceSlug as string | undefined)?.trim();
  const serviceSlug = rawSlug && rawSlug !== 'GENERAL'
    ? rawSlug
    : (serviceSlugs.length === 1 ? serviceSlugs[0] : (rawSlug ?? 'GENERAL'));

  if (!note || note.length < 5) {
    return NextResponse.json({ error: 'Please describe the revision needed (min 5 chars).' }, { status: 400 });
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Note too long (max 2000 chars).' }, { status: 400 });
  }

  // Enforce 2 FREE revisions per service (global count prevents cross-slug bypass)
  const FREE_LIMIT = 2;

  let revision;
  try {
    revision = await db.$transaction(async (tx) => {
      // Count ALL free revisions for this service slug (including any legacy GENERAL ones)
      const existingFreeRevisions = await tx.careerRevision.count({
        where: {
          clientId: client.id,
          requestedBy: 'client',
          chargeStatus: 'FREE',
          serviceSlug: serviceSlugs.length <= 1
            ? { in: [serviceSlug, 'GENERAL'] }  // single-service: treat GENERAL as same bucket
            : serviceSlug,                        // multi-service: per-slug only
        },
      });

      if (existingFreeRevisions >= FREE_LIMIT) {
        throw new Error('REVISION_LIMIT_EXCEEDED');
      }

      return tx.careerRevision.create({
        data: {
          clientId: client.id,
          requestedBy: 'client',
          note,
          fileLabel,
          serviceSlug,
          status: 'PENDING',
          chargeStatus: 'FREE',
        },
      });
    });
  } catch (err: any) {
    if (err.message === 'REVISION_LIMIT_EXCEEDED') {
      return NextResponse.json({
        error: 'You have used all 2 free revisions for this service. Contact support for a paid revision.',
      }, { status: 403 });
    }
    throw err;
  }

  const isFree = true; // Hard limit ensures all successful requests here are free

  // Log activity
  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'revision_requested',
      performedBy: 'client',
      metadata: { note: note.slice(0, 100), fileLabel, serviceSlug, chargeStatus: 'FREE' },
    },
  });

  // Notify admin in-app (DB notification)
  waitUntil(
    notifyAllAdmins({
      title: `${isFree ? 'Revision' : 'Paid Revision'} requested by ${client.name}`,
      message: `[${serviceSlug}] "${note.slice(0, 100)}${note.length > 100 ? '…' : ''}"`,
      type: isFree ? 'WARNING' : 'ERROR', // ERROR color draws attention to pending payments
      link: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
    }).catch(console.error)
  );

  // Notify admin via email
  const fileContext = fileLabel ? ` regarding "${fileLabel}"` : '';
  const pricingContext = isFree ? 'This is a free revision.' : '⚠️ The client has exhausted their free revisions for this service. A payment link needs to be generated.';
  
  waitUntil(
    sendCareerEmail({
      to: ADMIN_EMAIL,
      trigger: 'MESSAGE_NOTIFY',
      data: {
        recipientName: 'Catalyst Team',
        senderType: 'client',
        portalUrl: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
        subject: `Catalyst — ${client.name} has requested a ${isFree ? '' : 'PAID '}revision`,
        body: `${client.name} has submitted a new revision request for ${serviceSlug}${fileContext}. \n\n${pricingContext}\n\nRequest: "${note.slice(0, 200)}${note.length > 200 ? '…' : ''}"`,
      },
    }).catch(console.error)
  );

  // Auto-flip client status to REVISION_REQUESTED so admin sees it immediately
  if (['DRAFT_SENT', 'COMPLETED'].includes(client.status ?? '')) {
    await db.careerClient.update({
      where: { id: client.id },
      data: { status: 'REVISION_REQUESTED' },
    }).catch(err => console.error('[revisions POST] status flip failed:', err));
  }

  return NextResponse.json({
    ok: true,
    revision,
    requiresPayment: false,
    message: 'Revision requested successfully.',
  }, { status: 201 });
}
