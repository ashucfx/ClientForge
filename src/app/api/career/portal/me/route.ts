// src/app/api/career/portal/me/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getFormsForPackage } from '@/lib/career/forms';
import { PACKAGE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerPackage, CareerStatus } from '@/lib/career/types';

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
      pinHash: true,
      createdAt: true,
      forms: {
        select: { formType: true, submittedAt: true, version: true },
        orderBy: { submittedAt: 'desc' },
      },
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pkg = client.packageType as CareerPackage;
  const status = client.status as CareerStatus;
  const availableForms = getFormsForPackage(pkg);
  const submittedForms = new Set(client.forms.map((f: { formType: string }) => f.formType));

  return NextResponse.json({
    id: client.id,
    name: client.name,
    email: client.email,
    packageType: pkg,
    packageLabel: PACKAGE_LABELS[pkg],
    status,
    statusLabel: STATUS_LABELS[status],
    hasPinSet: !!client.pinHash,
    createdAt: client.createdAt,
    availableForms,
    submittedForms: Array.from(submittedForms),
    forms: client.forms,
  });
}
