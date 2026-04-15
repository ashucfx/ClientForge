// src/app/api/career/portal/deliverables/preview/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getDeliveryUrl } from '@/lib/career/cloudinary';

const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export async function GET(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const file = await db.careerDeliverable.findFirst({
    where: { id: fileId, clientId: payload.clientId },
    select: { fileUrl: true, mimeType: true, label: true },
  });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (DOCX_MIMES.has(file.mimeType)) {
    const fetchUrl  = await getDeliveryUrl(file.fileUrl, file.mimeType);
    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fetchUrl)}&embedded=true`;
    return NextResponse.redirect(viewerUrl, { status: 302 });
  }

  const fetchUrl = await getDeliveryUrl(file.fileUrl, file.mimeType);
  const upstream = await fetch(fetchUrl);

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type':        file.mimeType || upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${(file.label || 'preview').replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control':       'private, max-age=300',
    },
  });
}
