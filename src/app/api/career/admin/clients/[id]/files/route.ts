// src/app/api/career/admin/clients/[id]/files/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/career/cloudinary';

const MAX_FILES      = 7;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const files = await db.careerDeliverable.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true, _count: { select: { deliverables: true } } },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  if (client._count.deliverables >= MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per client` }, { status: 400 });
  }

  const formData = await req.formData();
  const file  = formData.get('file') as File | null;
  const label = (formData.get('label') as string | null) ?? file?.name ?? 'Deliverable';
  const fileType = (formData.get('fileType') as string | null) ?? 'other';

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
  }

  const uploaded = await uploadToCloudinary(file, params.id);

  const deliverable = await db.careerDeliverable.create({
    data: {
      clientId: params.id,
      label,
      fileUrl: uploaded.fileUrl,
      publicId: uploaded.publicId,
      fileType,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedBy: 'admin',
    },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: params.id,
      action: 'file_uploaded',
      performedBy: 'admin',
      metadata: { fileId: deliverable.id, label, fileType },
    },
  });

  return NextResponse.json({ file: deliverable }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fileId = searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const file = await db.careerDeliverable.findFirst({
    where: { id: fileId, clientId: params.id },
  });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteFromCloudinary(file.publicId).catch(console.error);
  await db.careerDeliverable.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true });
}
