export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return new NextResponse('Unauthorized', { status: 401 });

  const submissionId = req.nextUrl.searchParams.get('submissionId');
  const fieldKey = req.nextUrl.searchParams.get('fieldKey');
  if (!submissionId || !fieldKey) return new NextResponse('Missing params', { status: 400 });

  const sub = await db.careerFormSubmission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.clientId !== params.id) return new NextResponse('Not found', { status: 404 });

  const formData = sub.formData as Record<string, any>;
  const fileData = formData?.[fieldKey];
  if (!fileData || !fileData.dataUrl) return new NextResponse('No file found', { status: 404 });

  if (fileData.dataUrl.startsWith('http')) {
    return NextResponse.redirect(fileData.dataUrl);
  }

  const [header, base64] = fileData.dataUrl.split(',');
  const mimeType = header.replace('data:', '').replace(';base64', '');
  const buffer = Buffer.from(base64, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileData.name}"`,
    },
  });
}
