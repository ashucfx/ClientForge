// src/app/api/career/admin/clients/route.ts

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import type { CareerServiceSlug } from '@/lib/career/types';
import { resolveServices } from '@/lib/career/services';

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

export async function GET(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status  = searchParams.get('status')   ?? undefined;
  const lifecycleStatus = searchParams.get('lifecycleStatus') ?? 'ACTIVE';
  const search  = searchParams.get('search')   ?? undefined;
  const page    = Math.max(1, Number(searchParams.get('page')  ?? '1'));
  const limit   = Math.min(50, Math.max(10, Number(searchParams.get('limit') ?? '20')));

  const where = {
    ...(lifecycleStatus !== 'ALL' ? { lifecycleStatus } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search ? {
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
        services: { select: { service: { select: { slug: true, name: true } } } },
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
  if (!body?.name || !body?.email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 });
  }

  // services is an array of CareerService slugs e.g. ['RESUME','LINKEDIN']
  const slugs: CareerServiceSlug[] = Array.isArray(body.services) ? body.services : [];
  if (slugs.length === 0) {
    return NextResponse.json({ error: 'at least one service required' }, { status: 400 });
  }

  const email = (body.email as string).toLowerCase().trim();

  // Resolve service IDs — upsert seeds if missing
  const serviceRecords = await resolveServices(slugs);

  const magicToken  = generateMagicToken();
  const tokenExpiry = magicTokenExpiry();

  const client = await db.careerClient.upsert({
    where: { email },
    create: {
      name:      body.name as string,
      email,
      phone:     body.phone    ? String(body.phone).trim()    : null,
      notes:     body.notes    ? String(body.notes).trim()    : null,
      amountPaid: body.amountPaid ? Number(body.amountPaid)   : 0,
      currency:  body.currency ?? 'INR',
      magicToken,
      magicTokenExpiry: tokenExpiry,
      invoiceId: body.invoiceId ? String(body.invoiceId).trim() : null,
      services: {
        create: serviceRecords.map(s => ({ serviceId: s.id })),
      },
      activityLogs: {
        create: {
          action: 'client_created',
          performedBy: 'admin',
          metadata: { trigger: 'manual', services: slugs },
        },
      },
    },
    update: {
      magicToken,
      magicTokenExpiry: tokenExpiry,
    },
  });

  // Sync services on re-purchase (upsert each mapping)
  // Always sync services for returning clients (upsert handles duplicates)
  for (const s of serviceRecords) {
    await db.careerClientService.upsert({
      where: { clientId_serviceId: { clientId: client.id, serviceId: s.id } },
      create: { clientId: client.id, serviceId: s.id },
      update: {},
    });
  }

  const serviceNames = serviceRecords.map(s => s.name).join(', ');
  const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;

  // Send welcome email
  try {
    const resendId = await sendCareerEmail({
      to: email,
      trigger: 'WELCOME',
      data: { name: client.name, packageLabel: serviceNames, portalUrl },
    });
    await db.careerEmailLog.create({
      data: { clientId: client.id, trigger: 'WELCOME', resendId, status: 'sent' },
    });
  } catch (err) {
    console.error('[career/admin/clients] Welcome email failed:', err);
  }

  return NextResponse.json({ client }, { status: 201 });
}
