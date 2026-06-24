// src/app/api/career/admin/clients/[id]/files/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/career/cloudinary';
import { validateFileContent } from '@/lib/validateFile';
import { sendCareerEmail } from '@/lib/career/email';
import type { EmailTrigger } from '@/lib/career/types';
import { PORTAL_URL } from '@/lib/config';
import { resolvePackageLabel } from '@/lib/career/utils';
import { waitUntil } from '@vercel/functions';


const MAX_DRAFT_FILES = 7;
const MAX_FINAL_FILES = 10;
const MAX_FILE_BYTES  = 20 * 1024 * 1024; // 20 MB

/** File types that belong to the LinkedIn optimisation service */
const LINKEDIN_FILE_TYPES = new Set([
  'linkedin_banner', 'linkedin_profile_picture', 'linkedin_optimization', 'linkedin_content',
]);

/**
 * Choose which draft email to send based on fileType and whether the client
 * has had any revision requests (i.e. this is a revised draft).
 */
function resolveDraftTrigger(fileType: string, hasRevisions: boolean): EmailTrigger {
  if (LINKEDIN_FILE_TYPES.has(fileType)) return 'LINKEDIN_DRAFT';
  if (hasRevisions) return 'REVISED_DRAFT';
  return 'DRAFT_READY';
}

/**
 * Map a specific file type to the correct service label for the email.
 * e.g. "Your Resume draft is ready", "Your LinkedIn Profile draft is ready"
 */
function fileTypeToEmailLabel(ft: string, fallback: string): string {
  const map: Record<string, string> = {
    resume:                   'Resume',
    cover_letter:             'Cover Letter',
    linkedin_banner:          'LinkedIn Profile',
    linkedin_profile_picture: 'LinkedIn Profile',
    linkedin_optimization:    'LinkedIn Profile',
    linkedin_content:         'LinkedIn Profile',
    portfolio:                'Portfolio',
  };
  return map[ft] ?? fallback;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const files = await db.careerDeliverable.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  const drafts = files.filter(f => f.fileCategory === 'draft');
  const finals = files.filter(f => f.fileCategory !== 'draft');

  return NextResponse.json({ files, drafts, finals });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData     = await req.formData();
  const file         = formData.get('file') as File | null;
  const label        = (formData.get('label') as string | null) ?? file?.name ?? 'Deliverable';
  const fileType     = (formData.get('fileType') as string | null) ?? 'other';
  const fileCategory = ((formData.get('fileCategory') as string | null) ?? 'draft') === 'draft' ? 'draft' : 'final';
  const sendEmail    = formData.get('sendEmail') === 'true';

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
  }

  // Server-side magic bytes validation
  const validation = await validateFileContent(file, file.type);
  if (!validation.valid) {
    return NextResponse.json({ error: `Invalid file content: ${validation.reason}` }, { status: 400 });
  }

  // Enforce category-specific limits
  const categoryCount = await db.careerDeliverable.count({
    where: { clientId: params.id, fileCategory },
  });
  const limit = fileCategory === 'draft' ? MAX_DRAFT_FILES : MAX_FINAL_FILES;
  if (categoryCount >= limit) {
    return NextResponse.json(
      { error: `Maximum ${limit} ${fileCategory} files per client` },
      { status: 400 },
    );
  }

  const clientBase = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!clientBase) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const uploaded = await uploadToCloudinary(file, params.id);

  // Orphan cleanup — if DB write fails, delete the Cloudinary asset immediately
  let deliverable: Awaited<ReturnType<typeof db.careerDeliverable.create>>;
  try {
    deliverable = await db.careerDeliverable.create({
      data: {
        clientId:    params.id,
        label,
        fileUrl:     uploaded.fileUrl,
        publicId:    uploaded.publicId,
        fileType,
        mimeType:    uploaded.mimeType,
        sizeBytes:   uploaded.sizeBytes,
        resourceType: uploaded.resourceType,
        originalName: file.name || uploaded.originalName,
        fileCategory,
        uploadedBy:  'admin',
      },
    });
  } catch (dbErr) {
    await deleteFromCloudinary(uploaded.publicId, uploaded.resourceType).catch(console.error);
    throw dbErr;
  }

  await db.careerActivityLog.create({
    data: {
      clientId:    params.id,
      action:      'file_uploaded',
      performedBy: 'admin',
      metadata:    { fileId: deliverable.id, label, fileType, fileCategory },
    },
  });

  // ── Smart email notification ──────────────────────────────────────────────
  let emailTrigger: EmailTrigger | null = null;

  if (sendEmail) {
    const clientFull = await db.careerClient.findUnique({
      where: { id: params.id },
      select: {
        name: true, email: true, packageType: true,
        services:  { select: { service: { select: { slug: true, name: true } } } },
        revisions: { where: { requestedBy: 'client' }, select: { id: true } },
      },
    });

    if (clientFull) {
      const overallLabel  = resolvePackageLabel(clientFull);
      const portalUrl     = `${PORTAL_URL}/portal/dashboard`;
      const revisionsLeft = Math.max(0, 2 - clientFull.revisions.length);

      if (fileCategory === 'draft') {
        const hasRevisions = clientFull.revisions.length > 0;
        emailTrigger = resolveDraftTrigger(fileType, hasRevisions);

        // Dedup draft emails by trigger so retries do not resend the same draft type.
        const alreadySentDraftEmail = await db.careerEmailLog.findFirst({
          where: { clientId: params.id, trigger: emailTrigger, status: 'sent' },
        });

        if (alreadySentDraftEmail) {
          return NextResponse.json({ file: deliverable, emailTrigger: null }, { status: 201 });
        }

        waitUntil(
          sendCareerEmail({
            to:       clientFull.email,
            trigger:  emailTrigger,
            clientId: params.id,
            data: {
              name: clientFull.name,
              packageLabel: fileTypeToEmailLabel(fileType, overallLabel),
              portalUrl,
              revisionsLeft,
            },
          }).catch(err => console.error('[files POST] Draft email failed:', err))
        );

        // Auto-sync status to DRAFT_SENT and reset draftSentAt clock
        await db.careerClient.update({
          where: { id: params.id },
          data: { status: 'DRAFT_SENT', draftSentAt: new Date() }
        });

      } else {
        // Final deliverable — dedup: only send FINAL_DELIVERY email once per client
        const alreadySentFinal = await db.careerEmailLog.findFirst({
          where: { clientId: params.id, trigger: 'FINAL_DELIVERY', status: 'sent' },
        });

        emailTrigger = 'FINAL_DELIVERY';

        if (!alreadySentFinal) {
          const allFinals = await db.careerDeliverable.findMany({
            where:  { clientId: params.id, fileCategory: 'final' },
            select: { label: true, fileUrl: true },
          });

          const hasLinkedIn =
            clientFull.services.some(s => ['LINKEDIN', 'FULL_PACKAGE'].includes(s.service.slug)) ||
            ['LINKEDIN', 'FULL'].includes(clientFull.packageType ?? '');

          if (hasLinkedIn) {
            waitUntil(
              sendCareerEmail({
                to:      clientFull.email,
                trigger: 'LINKEDIN_SECURITY',
                data:    { name: clientFull.name },
              }).catch(console.error)
            );
          }

          waitUntil(
            sendCareerEmail({
              to:       clientFull.email,
              trigger:  emailTrigger,
              clientId: params.id,
              data: {
                name:         clientFull.name,
                packageLabel: overallLabel,
                portalUrl,
                files:        allFinals.map(f => ({ label: f.label, url: f.fileUrl })),
              },
            }).catch(err => console.error('[files POST] Final email failed:', err))
          );
        }

        // Auto-sync status to COMPLETED; set firstCompletedAt once (revision window anchor)
        const existingForWindow = await db.careerClient.findUnique({
          where: { id: params.id }, select: { firstCompletedAt: true },
        });
        await db.careerClient.update({
          where: { id: params.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            ...(existingForWindow?.firstCompletedAt ? {} : { firstCompletedAt: new Date() }),
          },
        });
      }
    }
  }

  return NextResponse.json({ file: deliverable, emailTrigger }, { status: 201 });
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

  await deleteFromCloudinary(file.publicId, file.resourceType).catch(console.error);
  await db.careerDeliverable.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true });
}
