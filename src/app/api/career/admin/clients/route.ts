// src/app/api/career/admin/clients/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage } from '@/lib/career/types';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

export async function GET(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status      = searchParams.get('status') ?? undefined;
  const packageType = searchParams.get('package') ?? undefined;
  const search      = searchParams.get('search') ?? undefined;
  const page        = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit       = Math.min(50, Math.max(10, Number(searchParams.get('limit') ?? '20')));

  const where = {
    ...(status      ? { status: status as never }      : {}),
    ...(packageType ? { packageType: packageType as never } : {}),
    ...(search      ? {
      OR: [
        { name:  { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [clients, total] = await Promise.all([
    db.careerClient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, email: true, phone: true,
        packageType: true, status: true, amountPaid: true, currency: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { forms: true, deliverables: true } },
      },
    }),
    db.careerClient.count({ where }),
  ]);

  return NextResponse.json({
    clients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// Manual client creation by admin
export async function POST(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email || !body?.packageType) {
    return NextResponse.json({ error: 'name, email, packageType required' }, { status: 400 });
  }

  const email = (body.email as string).toLowerCase().trim();
  const magicToken  = generateMagicToken();
  const tokenExpiry = magicTokenExpiry();

  const client = await db.careerClient.upsert({
    where: { email },
    create: {
      name: body.name as string,
      email,
      phone: body.phone as string | undefined,
      packageType: body.packageType as CareerPackage,
      amountPaid: body.amountPaid ? Number(body.amountPaid) : 0,
      currency: body.currency ?? 'INR',
      notes: body.notes as string | undefined,
      magicToken,
      magicTokenExpiry: tokenExpiry,
    },
    update: {
      packageType: body.packageType as CareerPackage,
      magicToken,
      magicTokenExpiry: tokenExpiry,
    },
  });

  // Send welcome email
  try {
    const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;
    const resendId = await sendCareerEmail({
      to: email,
      trigger: 'WELCOME',
      data: {
        name: client.name,
        packageLabel: PACKAGE_LABELS[client.packageType],
        portalUrl,
      },
    });
    await db.careerEmailLog.create({
      data: { clientId: client.id, trigger: 'WELCOME', resendId, status: 'sent' },
    });
  } catch (err) {
    console.error('[career/admin/clients] Welcome email failed:', err);
  }

  return NextResponse.json({ client }, { status: 201 });
}
