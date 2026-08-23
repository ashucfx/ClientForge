// src/app/api/career/portal/deliverables/download/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getDeliveryUrl, ensureExtension } from '@/lib/career/cloudinary';

export async function GET(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const file = await db.careerDeliverable.findFirst({
    where: { id: fileId, clientId: payload.clientId },
    select: { fileUrl: true, originalName: true, mimeType: true, label: true },
  });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fetchUrl = await getDeliveryUrl(file.fileUrl, file.mimeType);
  const upstream = await fetch(fetchUrl);

  if (!upstream.ok) {
    console.error('[portal download] fetch failed', upstream.status, fetchUrl);
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }

  const arrayBuffer = await upstream.arrayBuffer();

  const rawBaseName = file.originalName || file.label || 'deliverable';
  const clientPrefix = `${payload.clientId}_`;
  const baseName = rawBaseName.startsWith(clientPrefix) ? rawBaseName : `${clientPrefix}${rawBaseName}`;
  const filename = ensureExtension(baseName, file.mimeType);
  const safe     = filename.replace(/[^\w.\- ]/g, '_');

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type':        file.mimeType || upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control':       'no-store',
    },
  });
}
