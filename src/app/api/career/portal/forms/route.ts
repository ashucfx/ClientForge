// src/app/api/career/portal/forms/route.ts
// GET — return form schemas available to this client

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getFormsForPackage, DEFAULT_FORM_SCHEMAS } from '@/lib/career/forms';
import type { FormType } from '@/lib/career/types';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { packageType: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = getFormsForPackage(client.packageType);

  // Fetch overrides from DB (admin-editable schemas), fall back to defaults
  const dbSchemas = await db.careerFormSchema.findMany({
    where: { formType: { in: allowed } },
  });
  const dbMap = new Map(dbSchemas.map(s => [s.formType, s.schema as object]));

  const schemas = allowed.map(ft => ({
    ...(dbMap.has(ft) ? (dbMap.get(ft) as Record<string, unknown>) : (DEFAULT_FORM_SCHEMAS[ft as FormType] as unknown as Record<string, unknown>)),
    formType: ft,
  }));

  return NextResponse.json({ forms: schemas });
}
