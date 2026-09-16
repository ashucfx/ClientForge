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
import { addWorkingDays, getHolidaySet } from '@/lib/workingDays';


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
      id: true, name: true, email: true, status: true,
      completedAt: true, firstCompletedAt: true, lifecycleStatus: true,
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

  const invoiceIds = revisions.map(r => r.invoiceId).filter(Boolean) as string[];
  const invoices = invoiceIds.length > 0
    ? await db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          invoiceNumber: true,
          totalPayable: true,
          currency: true,
          currencySymbol: true,
          status: true,
          razorpayLinkUrl: true,
          paypalPaymentUrl: true,
        },
      })
    : [];
  const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));

  const enrichedRevisions = revisions.map(r => ({
    ...r,
    invoice: r.invoiceId ? invoiceMap.get(r.invoiceId) ?? null : null,
  }));

  return NextResponse.json({ revisions: enrichedRevisions });
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

  const body              = await req.json().catch(() => null);
  const rawNote           = (body?.note as string | undefined)?.trim();
  const fileLabel         = (body?.fileLabel as string | undefined)?.trim() || undefined;
  const isOutOfScope      = body?.isOutOfScope === true;
  const preferredCurrency = (body?.preferredCurrency as string | undefined)?.trim().toUpperCase() || 'USD';
  const outOfScopeCategory = (body?.outOfScopeCategory as string | undefined)?.trim().toUpperCase();
  const customReason      = (body?.outOfScopeReason as string | undefined)?.trim();

  // 15-day post-delivery window check
  const windowAnchor = client.firstCompletedAt ?? client.completedAt;
  let isWindowExpired = false;
  if (client.status === 'COMPLETED' && windowAnchor) {
    const daysSinceDelivery = Math.floor((Date.now() - new Date(windowAnchor).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 15) {
      isWindowExpired = true;
    }
  }

  // Resolve service slug: prefer what the client sends, fall back to primary service, then GENERAL
  const serviceSlugs = client.services.map(s => s.service.slug);
  const rawSlug = (body?.serviceSlug as string | undefined)?.trim();
  const serviceSlug = rawSlug && rawSlug !== 'GENERAL'
    ? rawSlug
    : (serviceSlugs.length === 1 ? serviceSlugs[0] : (rawSlug ?? 'GENERAL'));

  if (!rawNote || rawNote.length < 5) {
    return NextResponse.json({ error: 'Please describe the revision needed (min 5 chars).' }, { status: 400 });
  }
  if (rawNote.length > 2000) {
    return NextResponse.json({ error: 'Note too long (max 2000 chars).' }, { status: 400 });
  }

  // Enforce 2 FREE revisions per service (global count prevents cross-slug bypass)
  const FREE_LIMIT = 2;

  let isFree = true;
  let finalNote = rawNote;

  const revision = await db.$transaction(async (tx) => {
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

    const isQuotaExhausted = existingFreeRevisions >= FREE_LIMIT;
    isFree = !isOutOfScope && !isWindowExpired && !isQuotaExhausted;

    if (!isFree) {
      const category = outOfScopeCategory || (isQuotaExhausted || isWindowExpired ? 'POST_WINDOW' : 'OTHER');
      const reason = customReason || (
        isQuotaExhausted
          ? `Complimentary revision quota (${FREE_LIMIT}/${FREE_LIMIT}) exhausted.`
          : isWindowExpired
          ? 'Complimentary 15-day delivery revision window has elapsed.'
          : 'Substantive scope addition outside baseline complimentary revision guidelines.'
      );
      finalNote = `[OUT_OF_SCOPE_CATEGORY: ${category}]\n[OUT_OF_SCOPE_REASON: ${reason}]\n[PREFERRED_CURRENCY: ${preferredCurrency}]\n\n${rawNote}`;
    }

    return tx.careerRevision.create({
      data: {
        clientId: client.id,
        requestedBy: 'client',
        note: finalNote,
        fileLabel,
        serviceSlug,
        status: 'PENDING',
        chargeStatus: isFree ? 'FREE' : 'PENDING_PAYMENT',
        clientStatusBefore: client.status,
      },
    });
  });

  // Extend SLA by 3 working days only if free; paid revisions start SLA once quote is accepted & paid
  if (isFree) {
    const REVISION_SLA_DAYS = 3;
    const holidays = await getHolidaySet(db);
    const revisedDeadline = addWorkingDays(new Date(), REVISION_SLA_DAYS, holidays);
    await db.careerClient.update({
      where: { id: client.id },
      data: {
        slaDeadline:        revisedDeadline,
        expectedDeliveryAt: revisedDeadline,
      },
    });
  }

  // Log activity
  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: isFree ? 'revision_requested' : 'paid_revision_requested',
      performedBy: 'client',
      metadata: {
        note: finalNote.slice(0, 100), fileLabel, serviceSlug,
        chargeStatus: isFree ? 'FREE' : 'PENDING_PAYMENT',
        isOutOfScope,
        isWindowExpired,
        preferredCurrency,
      },
    },
  });

  // Notify admin in-app (DB notification)
  waitUntil(
    notifyAllAdmins({
      title: `${isFree ? 'Revision' : 'Paid / Out-of-Scope Revision'} requested by ${client.name}`,
      message: `[${serviceSlug}] "${finalNote.slice(0, 100)}${finalNote.length > 100 ? '…' : ''}"${!isFree ? ` · Currency: ${preferredCurrency}` : ''}`,
      type: isFree ? 'WARNING' : 'ERROR', // ERROR color draws attention to pending review/payment
      link: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
    }).catch(console.error)
  );

  // Notify admin via email
  const fileContext = fileLabel ? ` regarding "${fileLabel}"` : '';
  const pricingContext = isFree
    ? 'This is an included free revision.'
    : `⚠️ Out-of-Scope / Paid Revision Request. The client has requested this engagement (preferred currency: ${preferredCurrency}). Please review scope, set pricing, and approve in the admin panel.`;

  waitUntil(
    sendCareerEmail({
      to: ADMIN_EMAIL,
      trigger: 'MESSAGE_NOTIFY',
      data: {
        recipientName: 'Catalyst Team',
        senderType: 'client',
        portalUrl: `${PORTAL_URL}/career/${client.id}?tab=revisions`,
        subject: `Catalyst — ${client.name} requested a ${isFree ? '' : 'PAID / OUT-OF-SCOPE '}revision`,
        body: `${client.name} has submitted a revision request for ${serviceSlug}${fileContext}.\n\n${pricingContext}\n\nRequest Note:\n"${finalNote.slice(0, 500)}${finalNote.length > 500 ? '…' : ''}"`,
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
    requiresPayment: !isFree,
    message: isFree
      ? 'Revision requested successfully.'
      : 'Your paid revision request has been submitted to the Catalyst team for scope review and quote approval.',
  }, { status: 201 });
}
