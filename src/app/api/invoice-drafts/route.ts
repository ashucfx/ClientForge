import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function canAccessBrand(session: Awaited<ReturnType<typeof getAdminSession>>, brandId: string) {
  return Boolean(session && (session.role === 'SUPER_ADMIN' || session.brandAccess.includes(brandId)));
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brandId = request.nextUrl.searchParams.get('brandId');
  const clientId = request.nextUrl.searchParams.get('clientId');
  const where: { brandId?: string | { in: string[] }; clientId?: string } = {};
  if (brandId) {
    if (!canAccessBrand(session, brandId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    where.brandId = brandId;
  } else if (session.role !== 'SUPER_ADMIN') {
    where.brandId = { in: session.brandAccess };
  }
  if (clientId) where.clientId = clientId;

  const drafts = await prisma.invoiceDraft.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ drafts });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = DraftPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid draft data', details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;
  if (!canAccessBrand(session, payload.brandId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const draft = await prisma.invoiceDraft.create({
    data: {
      brandId: payload.brandId,
      clientId: payload.clientId,
      clientName: payload.clientName || null,
      clientEmail: payload.clientEmail || null,
      payload,
      createdByAdminId: session.adminId,
    },
  });
  return NextResponse.json({ draft }, { status: 201 });
}
