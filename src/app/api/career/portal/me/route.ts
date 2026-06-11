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

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      id: true, name: true, email: true,
      packageType: true, status: true,
      lifecycleStatus: true,
      waitingOn: true,
      pinHash: true, currency: true,
      createdAt: true,
      lastLoginAt: true,
      expectedDeliveryAt: true,
      services: { select: { service: { select: { slug: true, name: true } } } },
      forms: {
        select: { formType: true, submittedAt: true, version: true },
        orderBy: { submittedAt: 'desc' },
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
  
  // Calculate usage per service
  const revisionSummary = client.services.map(s => {
    const slug = s.service.slug;
    const freeUsed = revisionsList.filter(r => r.serviceSlug === slug && r.chargeStatus === 'FREE').length;
    const paidUsed = revisionsList.filter(r => r.serviceSlug === slug && r.chargeStatus !== 'FREE').length;
    return {
      slug,
      name: SERVICE_LABELS[slug as CareerServiceSlug] ?? s.service.name,
      freeLimit: FREE_LIMIT,
      freeUsed,
      revisionsLeft: Math.max(0, FREE_LIMIT - freeUsed),
      paidUsed
    };
  });
  
  // Fallback for global legacy view or clients with no services linked yet
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
  });
}
