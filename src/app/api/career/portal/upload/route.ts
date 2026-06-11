// src/app/api/career/portal/upload/route.ts
// Upload an attachment for client comments

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { prisma as db } from '@/lib/db';
import { uploadToCloudinary } from '@/lib/career/cloudinary';
import { validateFileContent } from '@/lib/validateFile';

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, lifecycleStatus: true },
  });
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (client.lifecycleStatus === 'ARCHIVED') return NextResponse.json({ error: 'Project is archived.' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PNG, JPG, PDF, DOCX.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 4 MB).' }, { status: 400 });
  }

  const validation = await validateFileContent(file, file.type);
  if (!validation.valid) {
    return NextResponse.json({ error: `Invalid file content: ${validation.reason}` }, { status: 400 });
  }

  const result = await uploadToCloudinary(file, `${client.id}/comments`);
  return NextResponse.json({
    name:     result.originalName,
    url:      result.fileUrl,
    mimeType: result.mimeType,
    size:     result.sizeBytes,
  });
}
