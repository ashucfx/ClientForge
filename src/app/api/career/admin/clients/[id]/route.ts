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
      Feedback: true,
      Review: true,
    },
  });

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch linked invoice separately (no Prisma relation defined on CareerClient.invoiceId)
  const linkedInvoice = client.invoiceId
    ? await db.invoice.findUnique({
        where: { id: client.invoiceId },
        select: { invoiceNumber: true, totalPayable: true, currency: true, status: true },
      })
    : null;

  const { services, forms, ...rest } = client as any;

  // Optimize payload: strip massive base64 file payloads from ALL versions
  // to prevent Vercel 504 timeouts and React rendering freezes.
  const optimizedForms = forms.map((f: any) => {
    let cleanData = f.formData as Record<string, any>;
    if (typeof cleanData === 'object' && cleanData !== null) {
      cleanData = JSON.parse(JSON.stringify(cleanData)); // deep clone
      for (const key of Object.keys(cleanData)) {
        const val = cleanData[key];
        if (typeof val === 'object' && val !== null && 'dataUrl' in val) {
          if (typeof val.dataUrl === 'string') {
            val.dataUrl = null; // STRIP IT!
            val.submissionId = f.id;
            val.fieldKey = key;
          }
        }
      }
    }
    return { ...f, formData: cleanData };
  });

  return NextResponse.json({
    client: {
      ...rest,
      slaDeadline: rest.expectedDeliveryAt,
      forms: optimizedForms,
      services: services.map((s: any) => ({ slug: s.service.slug, name: s.service.name })),
      invoice: linkedInvoice,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientCurrentState = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { lifecycleStatus: true }
  });
  if (!clientCurrentState) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.name        !== undefined) data.name        = String(body.name).trim();
  if (body.email       !== undefined) data.email       = String(body.email).trim().toLowerCase();
  if (body.phone       !== undefined) data.phone       = body.phone ? String(body.phone).trim() : null;
  if (body.notes       !== undefined) data.notes       = body.notes ? String(body.notes).trim() : null;
  if (body.packageType !== undefined) data.packageType = body.packageType;
  if (body.invoiceId   !== undefined) data.invoiceId   = body.invoiceId || null;
  if (body.invoiceNumber !== undefined) {
    const num = String(body.invoiceNumber).trim();
    if (!num) {
      data.invoiceId = null;
    } else {
      const inv = await db.invoice.findFirst({ where: { invoiceNumber: num }, select: { id: true } });
      if (!inv) return NextResponse.json({ error: `Invoice "${num}" not found. Check the invoice number and try again.` }, { status: 404 });
      data.invoiceId = inv.id;
    }
  }
  if (body.amountPaid  !== undefined) data.amountPaid  = Number(body.amountPaid);
  if (body.currency    !== undefined) data.currency    = String(body.currency).trim().toUpperCase();
  if (body.lifecycleStatus !== undefined) {
    data.lifecycleStatus = String(body.lifecycleStatus).trim();
    if (data.lifecycleStatus === 'ACTIVE' && clientCurrentState.lifecycleStatus === 'ARCHIVED') {
      const { generateMagicToken, magicTokenExpiry } = await import('@/lib/career/auth');
      data.reEngagedAt = new Date();
      data.magicToken = generateMagicToken();
      data.magicTokenExpiry = magicTokenExpiry();
      data.status = 'UNDER_PROCESS';
      data.completedAt = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const client = await db.careerClient.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, phone: true, packageType: true, status: true, amountPaid: true, currency: true, notes: true, invoiceId: true, lifecycleStatus: true, reEngagedAt: true },
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
