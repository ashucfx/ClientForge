// src/app/api/career/portal/forms/[type]/route.ts
// POST — submit / re-submit a form

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { canAccessForm } from '@/lib/career/forms';
import { sendCareerEmail } from '@/lib/career/email';
import type { FormType } from '@/lib/career/types';

const FORM_LABELS: Record<FormType, string> = {
  resume: 'Resume',
  linkedin: 'LinkedIn Optimisation',
  cover_letter: 'Cover Letter',
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await db.careerFormSubmission.findFirst({
    where: { clientId: payload.clientId, formType: params.type },
    orderBy: { version: 'desc' },
  });

  return NextResponse.json({ submission: existing ?? null });
}

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formType = params.type as FormType;
  const valid: FormType[] = ['resume', 'linkedin', 'cover_letter'];
  if (!valid.includes(formType)) {
    return NextResponse.json({ error: 'Invalid form type' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, email: true, packageType: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!canAccessForm(client.packageType, formType)) {
    return NextResponse.json({ error: 'Form not included in your package' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Get current version for this formType
  const latest = await db.careerFormSubmission.findFirst({
    where: { clientId: client.id, formType },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const submission = await db.careerFormSubmission.create({
    data: {
      clientId: client.id,
      formType,
      formData: body,
      version: nextVersion,
    },
  });

  // Advance status to SUBMITTED if still NOT_STARTED
  await db.careerClient.updateMany({
    where: { id: client.id, status: 'NOT_STARTED' },
    data: { status: 'SUBMITTED' },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'form_submitted',
      performedBy: 'client',
      metadata: { formType, version: nextVersion },
    },
  });

  // Confirmation email (non-blocking)
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
