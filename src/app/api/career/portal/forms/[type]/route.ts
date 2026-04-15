// src/app/api/career/portal/forms/[type]/route.ts
// GET — fetch existing submission | POST — submit / re-submit

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { getFormsForServices, PACKAGE_FORMS, normalizeFormType, legacyAliasesFor } from '@/lib/career/types';
import type { FormType, CareerServiceSlug } from '@/lib/career/types';

const VALID_FORM_TYPES: FormType[] = ['career_profile', 'linkedin_profile', 'portfolio_website'];

/** Add N business days (Mon-Fri) to a date */
function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip Sat(6) and Sun(0)
  }
  return d;
}

const FORM_LABELS: Record<FormType, string> = {
  career_profile:    'Career Profile Strategy Brief',
  linkedin_profile:  'LinkedIn Profile Optimization Brief',
  portfolio_website: 'Portfolio Website Development Brief',
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canonical = normalizeFormType(params.type);
  // Check canonical name AND all legacy aliases (e.g. career_profile → also check 'resume', 'cover_letter')
  const allNames = [canonical, ...legacyAliasesFor(canonical)];

  const existing = await db.careerFormSubmission.findFirst({
    where: { clientId: payload.clientId, formType: { in: allNames } },
    orderBy: { version: 'desc' },
  });

  return NextResponse.json({ submission: existing ?? null });
}

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accept both new canonical names and legacy aliases
  const formType = normalizeFormType(params.type) as FormType;
  if (!VALID_FORM_TYPES.includes(formType)) {
    return NextResponse.json({ error: 'Invalid form type' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      id: true, name: true, email: true, packageType: true,
      expectedDeliveryAt: true,
      services: { select: { service: { select: { slug: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Access check — services first, then legacy packageType
  let allowed: FormType[];
  if (client.services.length > 0) {
    const slugs = client.services.map(s => s.service.slug as CareerServiceSlug);
    allowed = getFormsForServices(slugs);
  } else if (client.packageType) {
    allowed = PACKAGE_FORMS[client.packageType] ?? [];
  } else {
    allowed = [];
  }

  if (!allowed.includes(formType)) {
    return NextResponse.json({ error: 'Form not included in your services' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const allFormNames = [formType, ...legacyAliasesFor(formType)];
  const latest = await db.careerFormSubmission.findFirst({
    where: { clientId: client.id, formType: { in: allFormNames } },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const submission = await db.careerFormSubmission.create({
    data: { clientId: client.id, formType, formData: body, version: nextVersion },
  });

  // Set expectedDeliveryAt (5 business days) on very first form submission
  const isFirstSubmission = !client.expectedDeliveryAt && (latest === null);
  await db.careerClient.updateMany({
    where: { id: client.id, status: 'NOT_STARTED' },
    data: {
      status: 'SUBMITTED',
      ...(isFirstSubmission ? { expectedDeliveryAt: addBusinessDays(new Date(), 5) } : {}),
    },
  });

  // If already SUBMITTED/beyond but no delivery date yet, set it now
  if (!client.expectedDeliveryAt && !isFirstSubmission) {
    const anyForm = await db.careerFormSubmission.count({ where: { clientId: client.id } });
    if (anyForm === 1) {
      await db.careerClient.update({
        where: { id: client.id },
        data: { expectedDeliveryAt: addBusinessDays(new Date(), 5) },
      });
    }
  }

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'form_submitted',
      performedBy: 'client',
      metadata: { formType, version: nextVersion },
    },
  });

  sendCareerEmail({
    to: client.email,
    trigger: 'FORM_CONFIRM',
    data: { name: client.name, formLabel: FORM_LABELS[formType] },
  }).then(async (resendId) => {
    await db.careerEmailLog.create({
      data: { clientId: client.id, trigger: 'FORM_CONFIRM', resendId, status: 'sent' },
    });
  }).catch(console.error);

  return NextResponse.json({ ok: true, submissionId: submission.id, version: nextVersion });
}
