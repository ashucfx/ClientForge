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
      pinHash: true, currency: true,
      createdAt: true,
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
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Determine available forms — services first, fall back to packageType
  const pkg = client.packageType as CareerPackage | null;
  const status = client.status as CareerStatus;

  let availableForms: import('@/lib/career/types').FormType[];
  let packageLabel: string;

  if (client.services.length > 0) {
    const slugs = client.services.map(s => s.service.slug as CareerServiceSlug);
    availableForms = getFormsForServices(slugs);
    packageLabel = slugs
      .map(slug => SERVICE_LABELS[slug] ?? slug)
      .join(', ');
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

  const revisionCount  = client.revisions.length;
  const revisionsLeft  = Math.max(0, 2 - revisionCount);

  return NextResponse.json({
    id: client.id,
    name: client.name,
    email: client.email,
    packageType: pkg,
    packageLabel,
    status,
    statusLabel: STATUS_LABELS[status],
    hasPinSet: !!client.pinHash,
    currency: client.currency,
    createdAt: client.createdAt,
    expectedDeliveryAt: client.expectedDeliveryAt ?? null,
    revisionCount,
    revisionsLeft,
    availableForms,
    submittedForms: Array.from(submittedFormsNormalized),
    forms: formsNormalized,
    services: client.services.map(s => ({
      slug: s.service.slug,
      name: SERVICE_LABELS[s.service.slug as CareerServiceSlug] ?? s.service.name,
    })),
  });
}
