// src/app/api/career/portal/deliverables/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const files = await db.careerDeliverable.findMany({
    where: { clientId: payload.clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, label: true, fileUrl: true,
      fileType: true, mimeType: true, createdAt: true,
    },
  });

  return NextResponse.json({ files });
}
