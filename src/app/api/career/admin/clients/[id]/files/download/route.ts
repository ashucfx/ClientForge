// src/app/api/career/admin/clients/[id]/files/download/route.ts
// Proxy Cloudinary file with correct Content-Disposition (original filename)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const file = await db.careerDeliverable.findFirst({
    where: { id: fileId, clientId: params.id },
    select: { fileUrl: true, originalName: true, mimeType: true, label: true },
  });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const upstream = await fetch(file.fileUrl);
  if (!upstream.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

  const filename = file.originalName || file.label || 'download';
  const safe = filename.replace(/[^\w.\- ]/g, '_');

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
    },
  });
}
