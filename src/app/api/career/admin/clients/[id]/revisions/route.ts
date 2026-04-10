// src/app/api/career/admin/clients/[id]/revisions/route.ts
// Admin can GET all revisions, POST a new one, and PATCH status (approve/deny)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const revisions = await db.careerRevision.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const note        = (body?.note as string | undefined)?.trim();
  const fileLabel   = (body?.fileLabel as string | undefined)?.trim() || undefined;
  const sendEmail   = body?.sendEmail !== false; // default true

  if (!note || note.length < 5) {
    return NextResponse.json({ error: 'Note required (min 5 chars).' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, packageType: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const revision = await db.careerRevision.create({
    data: {
      clientId: client.id,
      requestedBy: 'admin',
      note,
      fileLabel,
      status: 'PENDING',
    },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'revision_created_by_admin',
      performedBy: 'admin',
      metadata: { note: note.slice(0, 100), fileLabel },
    },
  });

  if (sendEmail) {
    try {
      await sendCareerEmail({
        to: client.email,
        trigger: 'REVISION',
        data: {
          name: client.name,
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          packageLabel: PACKAGE_LABELS[client.packageType as CareerPackage],
          revisionNote: note,
        },
      });
    } catch (err) {
      console.error('[admin/revisions] Email failed:', err);
    }
  }

  return NextResponse.json({ ok: true, revision }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const revisionId = body?.revisionId as string | undefined;
  const status     = body?.status as string | undefined;
  const adminNote  = (body?.adminNote as string | undefined)?.trim() || undefined;

  if (!revisionId || !['APPROVED', 'DENIED', 'PENDING'].includes(status ?? '')) {
    return NextResponse.json({ error: 'revisionId and valid status required' }, { status: 400 });
  }

  const revision = await db.careerRevision.update({
    where: { id: revisionId, clientId: params.id },
    data: { status: status!, adminNote },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: params.id,
      action: `revision_${status!.toLowerCase()}`,
      performedBy: 'admin',
      metadata: { revisionId, adminNote },
    },
  });

  return NextResponse.json({ ok: true, revision });
}
