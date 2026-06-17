import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSalesInquiry, assignInquiry } from '@/lib/sales/inquiryService';
import { prisma as db } from '@/lib/db';
import type { InquiryPriority } from '@prisma/client';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inquiry = await getSalesInquiry(params.id);
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data: inquiry });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const updated = await assignInquiry(
      params.id,
      body.assignedToId ?? null,
      body.priority as InquiryPriority | undefined,
      session.adminId
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Super admin required' }, { status: 403 });
  }

  const inquiry = await db.salesInquiry.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.salesInquiry.delete({ where: { id: params.id } });

  await db.auditLog.create({
    data: {
      tenantId: 'system',
      adminId:  session.adminId,
      action:   'INQUIRY_DELETED',
      entity:   'SalesInquiry',
      entityId: params.id,
      changes:  {},
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
