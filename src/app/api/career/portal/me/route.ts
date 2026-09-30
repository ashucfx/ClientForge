// src/app/api/career/portal/me/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getFormsForPackage } from '@/lib/career/forms';
import {
  PACKAGE_LABELS, STATUS_LABELS, SERVICE_LABELS,
  normalizeFormType, getFormsForServices,
} from '@/lib/career/types';
import type { CareerPackage, CareerStatus, CareerServiceSlug } from '@/lib/career/types';

import { waitUntil } from '@vercel/functions';
import { sendCareerEmail } from '@/lib/career/email';
import { expandClientServices, migrateClientToComponentServices } from '@/lib/career/services';
import { calculateRevisionWindow, calculateComponentRevisionWindow } from '@/lib/career/revisionWindow';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      id: true, name: true, email: true, phone: true, contact: { select: { country: true } },
      packageType: true, status: true,
      lifecycleStatus: true, completedAt: true, firstCompletedAt: true, draftSentAt: true,
      waitingOn: true,
      pinHash: true, currency: true,
      createdAt: true,
      lastLoginAt: true,
      expectedDeliveryAt: true,
      consultationStatus: true,
      consultationScheduledAt: true,
      consultationJoinUrl: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
      forms: {
        select: { formType: true, submittedAt: true, version: true },
        orderBy: { submittedAt: 'desc' },
      },
      deliverables: {
        select: { id: true, fileType: true, fileCategory: true, label: true, approvalStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      revisions: {
        where: { requestedBy: 'client' },
        select: { id: true },
      },
      ConversationReadState: { select: { unreadByClient: true } },
      Feedback: { select: { id: true } },
      Review: { select: { id: true } },
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Robustly synchronize lastLoginAt (throttle updates to every 15 minutes)
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (!client.lastLoginAt || client.lastLoginAt < fifteenMinsAgo) {
    // Non-blocking async update
    void db.careerClient.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() },
    }).catch(err => console.error('[portal/me] failed to sync lastLoginAt:', err));
  }

  // ── Lazy midpoint check-in email ─────────────────────────────────────────────
  // Fire once when client visits their dashboard at ≥50% of their SLA elapsed.
  // Uses CareerEmailLog unique constraint on (clientId, trigger) to prevent duplicates.
  // No schema changes — uses existing fields only.
  if (
    client.status === 'UNDER_PROCESS' &&
    client.expectedDeliveryAt &&
    client.forms.length > 0
  ) {
    const earliestForm = client.forms.reduce((a: typeof client.forms[0], b: typeof client.forms[0]) =>
      new Date(a.submittedAt) < new Date(b.submittedAt) ? a : b
    );
    const startMs   = new Date(earliestForm.submittedAt).getTime();
    const endMs     = new Date(client.expectedDeliveryAt).getTime();
    const nowMs     = Date.now();
    const totalMs   = endMs - startMs;
    const elapsedPct = totalMs > 0 ? (nowMs - startMs) / totalMs : 0;
    const daysRem   = Math.ceil(Math.max(0, endMs - nowMs) / 86400000);

    if (elapsedPct >= 0.5) {
      // Fire non-blocking — CareerEmailLog unique constraint prevents double-send
      waitUntil(
        (async () => {
          // Check if already sent
          const existing = await db.careerEmailLog.findUnique({
            where: { clientId_trigger: { clientId: client.id, trigger: 'MIDPOINT_UPDATE' } },
          }).catch(() => null);
          if (existing) return;

          // Derive packageLabel inline (same logic used below)
          let mpLabel = 'Career Services';
          if (client.services.length > 0) {
            const slugs = client.services.map((s: typeof client.services[0]) => s.service.slug);
            if (slugs.includes('PREMIUM_PLUS')) mpLabel = 'Premium Plus Package';
            else if (slugs.includes('FULL_PACKAGE') || ['RESUME', 'COVER_LETTER', 'LINKEDIN'].every((s: string) => slugs.includes(s))) mpLabel = 'Career Booster Package';
            else mpLabel = slugs.map((sl: string) => sl.replace(/_/g, ' ')).join(', ');
          }

          await sendCareerEmail({
            to:      client.email,
            trigger: 'MIDPOINT_UPDATE',
            clientId: client.id,
            data: {
              name:         client.name,
              packageLabel: mpLabel,
              portalUrl:    'https://catalyst.theripplenexus.com/portal/dashboard',
              daysRemaining: daysRem,
            },
          });
        })().catch((e: unknown) => console.error('[portal/me] midpoint email failed:', e))
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Determine available forms and clean component services
  const pkg = client.packageType as CareerPackage | null;
  const status = client.status as CareerStatus;

  const rawServices = client.services.map(s => ({
    slug: s.service.slug,
    name: s.service.name,
  }));
  const expandedServices = expandClientServices(rawServices, pkg);

  // If client has legacy bundle slugs (FULL_PACKAGE, PREMIUM_PLUS), migrate to component records in background
  const hasBundleSlug = rawServices.some(s => s.slug === 'FULL_PACKAGE' || s.slug === 'PREMIUM_PLUS');
  if (hasBundleSlug) {
    waitUntil(
      migrateClientToComponentServices(client.id, expandedServices).catch(err => {
        console.error('[portal/me] Migration failed:', err);
      })
    );
  }

  const componentSlugs = expandedServices.map(s => s.slug as CareerServiceSlug);
  const availableForms = getFormsForServices(componentSlugs);

  const hasCareerBooster = componentSlugs.includes('RESUME') &&
                           componentSlugs.includes('LINKEDIN') &&
                           componentSlugs.includes('COVER_LETTER');
  const hasPortfolio = componentSlugs.includes('PORTFOLIO');

  let packageLabel: string;
  if (hasCareerBooster && hasPortfolio) {
    packageLabel = 'Premium Plus Package';
  } else if (hasCareerBooster) {
    packageLabel = 'Career Booster Package';
  } else if (expandedServices.length > 0) {
    packageLabel = expandedServices.map(s => s.name).join(', ');
  } else if (pkg) {
    packageLabel = PACKAGE_LABELS[pkg] ?? pkg;
  } else {
    packageLabel = 'Career Services';
  }

  // Normalize submitted form types: old names (resume, linkedin) → new canonical names
  // This preserves existing DB data while presenting unified names to the frontend
  const submittedFormsNormalized = new Set(
    client.forms.map((f: { formType: string }) => normalizeFormType(f.formType))
  );

  // Return forms with normalized types for display, but keep raw for debugging
  const formsNormalized = client.forms.map(f => ({
    ...f,
    formType: normalizeFormType(f.formType),
  }));

  // Compute strict turnaround revision window
  const draftFiles = client.deliverables.filter(d => d.fileCategory === 'draft');
  const revisionWindow = calculateRevisionWindow({
    status: client.status,
    draftSentAt: client.draftSentAt,
    completedAt: client.completedAt,
    firstCompletedAt: client.firstCompletedAt,
    deliverableCreatedAt: draftFiles[0]?.createdAt ?? null,
  });

  // Per-service revision counters: strictly 2 free revisions per individual component
  const revisionsList = await db.careerRevision.findMany({
    where: { clientId: client.id, requestedBy: 'client' },
    select: { serviceSlug: true, chargeStatus: true }
  });

  const FREE_LIMIT = 2;
  const isWindowExpired = revisionWindow.isExpired;

  const revisionSummary = expandedServices.map((comp, idx) => {
    const slug = comp.slug;
    const slugFreeUsed = revisionsList.filter(
      r => (r.serviceSlug === slug || (idx === 0 && (!r.serviceSlug || r.serviceSlug === 'GENERAL' || r.serviceSlug === 'FULL_PACKAGE' || r.serviceSlug === 'PREMIUM_PLUS'))) && r.chargeStatus === 'FREE'
    ).length;
    const paidUsed = revisionsList.filter(
      r => (r.serviceSlug === slug || (idx === 0 && (!r.serviceSlug || r.serviceSlug === 'GENERAL' || r.serviceSlug === 'FULL_PACKAGE' || r.serviceSlug === 'PREMIUM_PLUS'))) && r.chargeStatus !== 'FREE'
    ).length;

    // Calculate independent review cycle per component
    const compWindow = calculateComponentRevisionWindow({
      serviceSlug: slug,
      clientStatus: client.status,
      completedAt: client.completedAt,
      firstCompletedAt: client.firstCompletedAt,
      deliverables: client.deliverables,
      draftSentAt: client.draftSentAt,
    });

    return {
      slug,
      name: comp.name,
      freeLimit: FREE_LIMIT,
      freeUsed: slugFreeUsed,
      revisionsLeft: compWindow.isExpired ? 0 : Math.max(0, FREE_LIMIT - slugFreeUsed),
      paidUsed,
      isWindowExpired: compWindow.isExpired,
      revisionWindow: compWindow,
    };
  });

  const totalRevisionsLeft = revisionSummary.reduce((acc, s) => acc + s.revisionsLeft, 0);
  const revisionCount = revisionsList.length;

  // Fallback for legacy clients without expectedDeliveryAt
  let fallbackDeliveryAt = null;
  if (!client.expectedDeliveryAt && client.forms.length > 0) {
    // Find the earliest form submission
    const earliestForm = client.forms.reduce((earliest: any, current: any) => {
      return new Date(current.submittedAt) < new Date(earliest.submittedAt) ? current : earliest;
    });
    
    // Add 5 business days
    const d = new Date(earliestForm.submittedAt);
    let added = 0;
    while (added < 5) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    fallbackDeliveryAt = d.toISOString();
  }

  const slaLog = await db.careerActivityLog.findFirst({
    where: { clientId: client.id, action: 'sla_agreement_accepted' },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone ?? null,
    country: client.contact?.country ?? null,
    slaAccepted: Boolean(slaLog),
    slaAcceptedAt: slaLog?.createdAt ?? null,
    slaVersion: (slaLog?.metadata as any)?.version ?? null,
    packageType: pkg,
    packageLabel,
    status,
    statusLabel: STATUS_LABELS[status],
    waitingOn: client.waitingOn,
    hasPinSet: !!client.pinHash,
    currency: client.currency,
    createdAt: client.createdAt,
    expectedDeliveryAt: client.expectedDeliveryAt ?? fallbackDeliveryAt,
    revisionCount,
    revisionsLeft: totalRevisionsLeft,
    revisionSummary,
    completedAt: client.completedAt,
    firstCompletedAt: client.firstCompletedAt,
    draftSentAt: client.draftSentAt,
    revisionWindow,
    availableForms,
    submittedForms: Array.from(submittedFormsNormalized),
    forms: formsNormalized,
    services: expandedServices,
    unreadMessages: client.ConversationReadState?.unreadByClient ?? 0,
    hasSubmittedFeedback: !!client.Feedback,
    hasSubmittedReview: !!client.Review,
    deliverables: client.deliverables,
    consultationStatus: client.consultationStatus,
    consultationScheduledAt: client.consultationScheduledAt,
    consultationJoinUrl: client.consultationJoinUrl,
  });
}
