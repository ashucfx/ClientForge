// src/app/api/career/admin/clients/[id]/forms/[type]/route.ts
// Admin: GET or POST a client form submission on their behalf.
// Protected by isAdminRequest() (cf_admin JWT cookie, enforced by middleware).

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { DEFAULT_FORM_SCHEMAS } from '@/lib/career/forms';
import {
  getFormsForServices, PACKAGE_FORMS,
  normalizeFormType, legacyAliasesFor,
} from '@/lib/career/types';
import type { FormType, CareerServiceSlug } from '@/lib/career/types';
import { addWorkingDays, slaForSlugs, getHolidaySet } from '@/lib/workingDays';
import { waitUntil } from '@vercel/functions';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

const VALID_FORM_TYPES: FormType[] = ['career_profile', 'linkedin_profile', 'portfolio_website'];

const FORM_LABELS: Record<FormType, string> = {
  career_profile:    'Career Profile Strategy Brief',
  linkedin_profile:  'LinkedIn Profile Optimization Brief',
  portfolio_website: 'Portfolio Website Development Brief',
};

// GET: fetch existing submission + schema for a specific client
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; type: string } },
) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const canonical = normalizeFormType(params.type);
  const allNames  = [canonical, ...legacyAliasesFor(canonical)];
  const [client, existing] = await Promise.all([
    db.careerClient.findUnique({
      where: { id: params.id },
      select: {
        packageType: true,
        services: { select: { service: { select: { slug: true } } } },
      },
    }),
    db.careerFormSubmission.findFirst({
      where: { clientId: params.id, formType: { in: allNames } },
      orderBy: { version: 'desc' },
    }),
  ]);
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  const formSchema = DEFAULT_FORM_SCHEMAS[canonical as FormType] ?? null;
  return NextResponse.json({ submission: existing ?? null, schema: formSchema });
}

// POST: admin fills the form on behalf of a client
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; type: string } },
) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const formType = normalizeFormType(params.type) as FormType;
  if (!VALID_FORM_TYPES.includes(formType)) {
    return NextResponse.json({ error: 'Invalid form type' }, { status: 400 });
  }
  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true,
      packageType: true,
      expectedDeliveryAt: true, slaDeadline: true,
      lifecycleStatus: true,
      services: { select: { service: { select: { slug: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (client.lifecycleStatus === 'ARCHIVED') {
    return NextResponse.json({ error: 'Project is archived. Form editing is disabled.' }, { status: 403 });
  }
  // Verify form is included in client services
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
    return NextResponse.json({ error: "Form not included in this client's services" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const allFormNames = [formType, ...legacyAliasesFor(formType)];
  const latest = await db.careerFormSubmission.findFirst({
    where: { clientId: client.id, formType: { in: allFormNames } },
    orderBy: { version: 'desc' },
    select: { version: true, formData: true },
  });

  // RESTORE STRIPPED FILE URLS
  // The Admin GET API strips file dataUrl to null. If the admin submits the form
  // without changing the file, it comes back as null. We must inject the original URL back.
  if (latest?.formData && typeof latest.formData === 'object') {
    const prevData = latest.formData as Record<string, any>;
    for (const key of Object.keys(body)) {
      const val = body[key];
      if (typeof val === 'object' && val !== null && 'dataUrl' in val && val.dataUrl === null) {
        const prevVal = prevData[key];
        if (typeof prevVal === 'object' && prevVal !== null && typeof prevVal.dataUrl === 'string') {
          val.dataUrl = prevVal.dataUrl;
        }
      }
    }
  }

  const nextVersion = (latest?.version ?? 0) + 1;
  const submission = await db.careerFormSubmission.create({
    data: { clientId: client.id, formType, formData: body, version: nextVersion },
  });
  // SLA: recalculate on submission (same logic as client-facing portal)
  const slugs = client.services.map(s => s.service.slug);
  const slaDays = slaForSlugs(slugs);
  const holidays = await getHolidaySet(db);
  const newDeadline = addWorkingDays(new Date(), slaDays, holidays);
  const isFirstSubmission = !client.expectedDeliveryAt;
  await db.careerClient.updateMany({
    where: { id: client.id, status: 'NOT_STARTED' },
    data: { status: 'SUBMITTED' },
  });
  await db.careerClient.update({
    where: { id: client.id },
    data: { expectedDeliveryAt: newDeadline, slaDeadline: newDeadline },
  });
  // Activity log: marks this as admin action
  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'form_submitted',
      performedBy: 'admin',
      metadata: { formType, version: nextVersion, filledByAdmin: true },
    },
  });
  const deliveryDateStr = newDeadline.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  // Fire emails in background (non-blocking)
  waitUntil((async () => {
    // Immediate notification to client that admin filled their brief
    await sendCareerEmail({
      to: client.email,
      trigger: 'ADMIN_FORM_FILLED',
      clientId: client.id,
      data: {
        name: client.name,
        formLabel: FORM_LABELS[formType],
        portalUrl: `${PORTAL_URL}/portal/dashboard`,
      },
    }).catch(console.error);
    // First-submission only: send delivery date notification
    if (isFirstSubmission) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          subject: 'Catalyst - Your expected delivery date',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          body: `Your brief has been received. Our team will deliver your work by **${deliveryDateStr}** (${slaDays} working days, excluding weekends and public holidays). You will hear from us as soon as your first draft is ready.`,
        },
      }).catch(console.error);
    }
  })());
  return NextResponse.json({ ok: true, submissionId: submission.id, version: nextVersion });
}
