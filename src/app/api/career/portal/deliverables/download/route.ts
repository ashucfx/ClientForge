// src/app/api/career/portal/deliverables/download/route.ts
// Proxy Cloudinary file with correct Content-Disposition for portal clients

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

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
