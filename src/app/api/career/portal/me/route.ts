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
      lifecycleStatus: true, completedAt: true, firstCompletedAt: true,
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
        select: { fileType: true, fileCategory: true, label: true, approvalStatus: true },
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

  // Determine available forms — services first, fall back to packageType
  const pkg = client.packageType as CareerPackage | null;
  const status = client.status as CareerStatus;

  let availableForms: import('@/lib/career/types').FormType[];
  let packageLabel: string;

  if (client.services.length > 0) {
    const slugs = client.services.map(s => s.service.slug as CareerServiceSlug);
    availableForms = getFormsForServices(slugs);
    const hasCareerBooster = slugs.includes('FULL_PACKAGE') || ['RESUME', 'COVER_LETTER', 'LINKEDIN'].every(s => slugs.includes(s as CareerServiceSlug));
    if (slugs.includes('PREMIUM_PLUS') || (hasCareerBooster && slugs.includes('PORTFOLIO'))) {
      packageLabel = 'Premium Plus Package';
    } else if (hasCareerBooster) {
      packageLabel = 'Career Booster Package';
    } else {
      packageLabel = slugs
        .map(slug => SERVICE_LABELS[slug] ?? slug)
        .join(', ');
    }
  } else if (pkg) {
    availableForms = getFormsForPackage(pkg);
    packageLabel = PACKAGE_LABELS[pkg] ?? pkg;
  } else {
    availableForms = [];
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

  // Per-service revision counters
  const revisionsList = await db.careerRevision.findMany({
    where: { clientId: client.id, requestedBy: 'client' },
    select: { serviceSlug: true, chargeStatus: true }
  });

  const FREE_LIMIT = 2;
  const serviceSlugs = new Set(client.services.map(s => s.service.slug));
  const isSingleService = client.services.length === 1;

  // Revisions with 'GENERAL' slug (legacy default when service wasn't mapped yet)
  const generalFreeUsed = revisionsList.filter(
    r => r.chargeStatus === 'FREE' && (!r.serviceSlug || r.serviceSlug === 'GENERAL' || !serviceSlugs.has(r.serviceSlug))
  ).length;

  // Calculate usage per service — GENERAL revisions count toward the primary service
  // for single-service clients (prevents showing 2/2 when 1 GENERAL revision exists)
  const revisionSummary = client.services.map((s, idx) => {
    const slug = s.service.slug;
    const slugFreeUsed = revisionsList.filter(r => r.serviceSlug === slug && r.chargeStatus === 'FREE').length;
    // Attribute GENERAL revisions to primary (first) service for single-service clients
    const freeUsed = isSingleService
      ? slugFreeUsed + generalFreeUsed
      : (idx === 0 ? slugFreeUsed + generalFreeUsed : slugFreeUsed);
    const paidUsed = revisionsList.filter(r => r.serviceSlug === slug && r.chargeStatus !== 'FREE').length;
    return {
      slug,
      name: SERVICE_LABELS[slug as CareerServiceSlug] ?? s.service.name,
      freeLimit: FREE_LIMIT,
      freeUsed,
      revisionsLeft: Math.max(0, FREE_LIMIT - freeUsed),
      paidUsed,
    };
  });

  // Global fallback (for clients with no services linked yet)
  const globalFreeUsed = revisionsList.filter(r => r.chargeStatus === 'FREE').length;
  const revisionsLeft = Math.max(0, FREE_LIMIT - globalFreeUsed);
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

  return NextResponse.json({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone ?? null,
    country: client.contact?.country ?? null,
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
    revisionsLeft,
    revisionSummary,
    completedAt: client.completedAt,
    firstCompletedAt: client.firstCompletedAt,
    availableForms,
    submittedForms: Array.from(submittedFormsNormalized),
    forms: formsNormalized,
    services: client.services.map(s => ({
      slug: s.service.slug,
      name: SERVICE_LABELS[s.service.slug as CareerServiceSlug] ?? s.service.name,
    })),
    unreadMessages: client.ConversationReadState?.unreadByClient ?? 0,
    hasSubmittedFeedback: !!client.Feedback,
    hasSubmittedReview: !!client.Review,
    deliverables: client.deliverables,
    consultationStatus: client.consultationStatus,
    consultationScheduledAt: client.consultationScheduledAt,
    consultationJoinUrl: client.consultationJoinUrl,
  });
}
