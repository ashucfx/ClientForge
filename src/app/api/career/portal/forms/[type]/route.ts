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
import { addWorkingDays, slaForSlugs, getHolidaySet } from '@/lib/workingDays';
import { waitUntil } from '@vercel/functions';

const VALID_FORM_TYPES: FormType[] = ['career_profile', 'linkedin_profile', 'portfolio_website'];

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
      expectedDeliveryAt: true, slaDeadline: true,
      lifecycleStatus: true,
      services: { select: { service: { select: { slug: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (client.lifecycleStatus === 'ARCHIVED') return NextResponse.json({ error: 'Project is archived. Form editing disabled.' }, { status: 403 });

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

  // Time-based idempotency lock (5 seconds) to prevent double-click race conditions
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  const recentSubmission = await db.careerFormSubmission.findFirst({
    where: { 
      clientId: client.id, 
      formType: { in: allFormNames },
      submittedAt: { gte: fiveSecondsAgo } 
    }
  });

  if (recentSubmission) {
    return NextResponse.json({ 
      ok: true, 
      submissionId: recentSubmission.id, 
      version: recentSubmission.version, 
      _idempotent: true 
    });
  }

  const latest = await db.careerFormSubmission.findFirst({
    where: { clientId: client.id, formType: { in: allFormNames } },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const submission = await db.careerFormSubmission.create({
    data: { clientId: client.id, formType, formData: body, version: nextVersion },
  });

  // SLA: recalculate on every form submit (first submit sets it; re-submissions push it
  // forward from the new submission date, since the work clock restarts on revised inputs).
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

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'form_submitted',
      performedBy: 'client',
      metadata: { formType, version: nextVersion },
    },
  });

  const deliveryDateStr = newDeadline.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  waitUntil((async () => {
    // Form confirmation email
    await sendCareerEmail({
      to: client.email,
      trigger: 'FORM_CONFIRM',
      data: { name: client.name, formLabel: FORM_LABELS[formType] },
    }).then(async (resendId) => {
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'FORM_CONFIRM', resendId, status: 'sent' },
      });
    }).catch(console.error);

    // SLA notification — only on first submission (re-submissions don't need a new email)
    if (isFirstSubmission) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: client.name,
          senderType: 'admin',
          subject: 'Catalyst — Your expected delivery date',
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/portal/dashboard`,
          body: `Your brief has been received! Our team will deliver your work by **${deliveryDateStr}** (${slaDays} working days, excluding weekends and public holidays). You'll hear from us as soon as your first draft is ready.`,
        },
      }).catch(console.error);
    }
  })());

  return NextResponse.json({ ok: true, submissionId: submission.id, version: nextVersion });
}
