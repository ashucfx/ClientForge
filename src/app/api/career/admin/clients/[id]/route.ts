// src/app/api/career/admin/clients/[id]/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    include: {
      forms: { orderBy: [{ formType: 'asc' }, { version: 'desc' }] },
      deliverables: { orderBy: { createdAt: 'desc' } },
      emailLogs: { orderBy: { sentAt: 'desc' }, take: 20 },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.name        !== undefined) data.name        = String(body.name).trim();
  if (body.email       !== undefined) data.email       = String(body.email).trim().toLowerCase();
  if (body.phone       !== undefined) data.phone       = body.phone ? String(body.phone).trim() : null;
  if (body.notes       !== undefined) data.notes       = body.notes ? String(body.notes).trim() : null;
  if (body.packageType !== undefined) data.packageType = body.packageType;
  if (body.invoiceId   !== undefined) data.invoiceId   = body.invoiceId || null;
  if (body.amountPaid  !== undefined) data.amountPaid  = Number(body.amountPaid);
  if (body.currency    !== undefined) data.currency    = String(body.currency).trim().toUpperCase();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const client = await db.careerClient.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, phone: true, packageType: true, status: true, amountPaid: true, currency: true, notes: true, invoiceId: true },
  });

  await db.careerActivityLog.create({
    data: {
      clientId: client.id,
      action: 'client_edited',
      performedBy: 'admin',
      metadata: { updatedFields: Object.keys(data) },
    },
  });

  return NextResponse.json({ ok: true, client });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { name: true, email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  await db.careerClient.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, deleted: { name: client.name } });
}
