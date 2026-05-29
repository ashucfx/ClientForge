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
      services: { select: { service: { select: { slug: true, name: true } } } },
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { services, forms, ...rest } = client;
  
  // Optimize payload: only send formData for the latest version of each form type.
  // Historical versions can contain massive base64 file payloads which crash the serverless edge response.
  const optimizedForms = forms.map((f, i, arr) => {
    const isLatest = !arr.some(other => other.formType === f.formType && other.version > f.version);
    if (!isLatest) {
      return { 
        ...f, 
        formData: { _omitted: 'Payload omitted for performance. Only the latest version is loaded.' } 
      };
    }
    return f;
  });

  return NextResponse.json({
    client: {
      ...rest,
      forms: optimizedForms,
      services: services.map(s => ({ slug: s.service.slug, name: s.service.name })),
    },
  });
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

// DELETE is now OTP-gated — use POST /[id]/delete-otp then DELETE /[id]/delete-otp?otp=...
export async function DELETE() {
  return NextResponse.json(
    { error: 'Use POST /delete-otp to request an OTP, then DELETE /delete-otp?otp=... to confirm.' },
    { status: 405 },
  );
}
