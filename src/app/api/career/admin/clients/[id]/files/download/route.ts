// src/app/api/career/admin/clients/[id]/files/download/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { getDeliveryUrl, ensureExtension } from '@/lib/career/cloudinary';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const file = await db.careerDeliverable.findFirst({
    where: { id: fileId, clientId: params.id },
    select: { fileUrl: true, originalName: true, mimeType: true, label: true },
  });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fetchUrl = await getDeliveryUrl(file.fileUrl, file.mimeType);
  const upstream = await fetch(fetchUrl);

  if (!upstream.ok || !upstream.body) {
    console.error('[admin download] fetch failed', upstream.status, fetchUrl);
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }

  const baseName = file.originalName || file.label || 'download';
  const filename = ensureExtension(baseName, file.mimeType);
  const safe     = filename.replace(/[^\w.\- ]/g, '_');

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type':        file.mimeType || upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control':       'no-store',
    },
  });
}
