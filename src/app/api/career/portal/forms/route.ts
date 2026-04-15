// src/app/api/career/portal/forms/route.ts
// GET — return form schemas available to this client (service-based)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { DEFAULT_FORM_SCHEMAS } from '@/lib/career/forms';
import { getFormsForServices, PACKAGE_FORMS } from '@/lib/career/types';
import type { FormType, CareerServiceSlug } from '@/lib/career/types';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      packageType: true,
      services: { select: { service: { select: { slug: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Prefer dynamic services; fall back to legacy packageType
  let allowed: FormType[];
  if (client.services.length > 0) {
    const slugs = client.services.map(s => s.service.slug as CareerServiceSlug);
    allowed = getFormsForServices(slugs);
  } else if (client.packageType) {
    allowed = PACKAGE_FORMS[client.packageType] ?? [];
  } else {
    allowed = [];
  }

  // Fetch DB overrides, fall back to defaults
  const dbSchemas = await db.careerFormSchema.findMany({
    where: { formType: { in: allowed } },
  });
  const dbMap = new Map(dbSchemas.map(s => [s.formType, s.schema as object]));

  const schemas = allowed.map(ft => ({
    ...(dbMap.has(ft)
      ? (dbMap.get(ft) as Record<string, unknown>)
      : (DEFAULT_FORM_SCHEMAS[ft as FormType] as unknown as Record<string, unknown>)),
    formType: ft,
  }));

  return NextResponse.json({ forms: schemas });
}
