// src/app/api/career/admin/clients/[id]/upload/route.ts
// Upload an attachment for admin comments

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/career/cloudinary';
import { validateFileContent } from '@/lib/validateFile';

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PNG, JPG, PDF, DOCX.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 400 });
  }

  const validation = await validateFileContent(file, file.type);
  if (!validation.valid) {
    return NextResponse.json({ error: `Invalid file content: ${validation.reason}` }, { status: 400 });
  }

  const result = await uploadToCloudinary(file, `${params.id}/comments`);
  return NextResponse.json({
    name:     result.originalName,
    url:      result.fileUrl,
    mimeType: result.mimeType,
    size:     result.sizeBytes,
  });
}
