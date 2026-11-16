import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

const DraftPayloadSchema = z.object({
  clientId: z.string().cuid().optional(),
  clientName: z.string().max(200).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().max(50).optional(),
  companyName: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  clientType: z.enum(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS', 'AGENCY_CLIENT']).optional(),
  currencyOverride: z.string().max(10).optional(),
  packageSlug: z.string().max(50).optional(),
  lineItems: z.array(z.object({
    id: z.string(),
    description: z.string().max(500),
    shortDescription: z.string().max(2000).optional(),
    qty: z.number().min(0).max(100000),
    unitPrice: z.number().min(0).max(100000000),
    lineTotal: z.number().min(0).max(100000000),
  })).max(100),
  discountRate: z.number().min(0).max(100),
  taxRate: z.number().min(0).max(100),
  notes: z.string().max(10000).optional(),
  dueDays: z.number().int().min(1).max(90),
  paymentGateway: z.string().max(100),
  installmentCount: z.number().int().min(1).max(3),
  sourceChannel: z.string().max(100),
  referralId: z.string().max(200).optional(),
  brandId: z.enum(['catalyst', 'ripple_nexus']).default('catalyst'),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const draft = await prisma.invoiceDraft.findUnique({ where: { id: params.id } });
  if (!draft || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(draft.brandId))) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  return NextResponse.json({ draft });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.invoiceDraft.findUnique({ where: { id: params.id } });
  if (!existing || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(existing.brandId))) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  const parsed = DraftPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid draft data', details: parsed.error.flatten() }, { status: 400 });
  const payload = parsed.data;
  if (payload.brandId !== existing.brandId && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const draft = await prisma.invoiceDraft.update({
    where: { id: params.id },
    data: {
      brandId: payload.brandId,
      clientId: payload.clientId,
      clientName: payload.clientName || null,
      clientEmail: payload.clientEmail || null,
      payload,
    },
  });
  return NextResponse.json({ draft });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.invoiceDraft.findUnique({ where: { id: params.id } });
  if (!existing || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(existing.brandId))) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  await prisma.invoiceDraft.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
