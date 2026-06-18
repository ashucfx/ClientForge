// src/app/api/career/webhook/route.ts
// Razorpay webhook for Career Booster — creates client, maps services, sends welcome email

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';

import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { sendAdminPaymentAlert } from '@/lib/email';
import type { CareerServiceSlug } from '@/lib/career/types';
import { resolveServices } from '@/lib/career/services';

const WEBHOOK_SECRET =
  process.env.RAZORPAY_CAREER_WEBHOOK_SECRET ?? process.env.RAZORPAY_WEBHOOK_SECRET!;

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com');

function verifySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function packageToSlugs(raw: string): CareerServiceSlug[] {
  const upper = raw.toUpperCase();
  const map: Record<string, CareerServiceSlug[]> = {
    RESUME:       ['RESUME'],
    LINKEDIN:     ['LINKEDIN'],
    COVER_LETTER: ['COVER_LETTER'],
    FULL:         ['RESUME', 'COVER_LETTER', 'LINKEDIN'],
    FULL_PACKAGE: ['RESUME', 'COVER_LETTER', 'LINKEDIN'],
    PORTFOLIO:    ['PORTFOLIO'],
  };
  return map[upper] ?? [];
}

export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: {
    event: string;
    payload: {
      payment?: {
        entity: {
          id: string;
          order_id?: string;
          amount: number;
          currency: string;
          notes?: {
            client_name?: string;
            name?: string;
            client_email?: string;
            email?: string;
            client_phone?: string;
            phone?: string;
            package_type?: string;
            career_package?: string;
            services?: string;      // comma-separated slugs e.g. "RESUME,LINKEDIN"
            module?: string;
          };
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.event !== 'payment.captured') return NextResponse.json({ received: true });

  const payment = event.payload.payment?.entity;
  if (!payment) return NextResponse.json({ received: true });

  const notes  = payment.notes ?? {};
  const paymentModule = notes.module;
  if (paymentModule && paymentModule !== 'career') return NextResponse.json({ received: true });

  // Parse services — prefer `services` note (comma-separated slugs), fall back to single package
  let slugs: CareerServiceSlug[] = [];
  if (notes.services) {
    slugs = notes.services
      .split(',')
      .map(s => s.trim().toUpperCase() as CareerServiceSlug)
      .filter(Boolean);
  } else {
    const packageRaw = notes.career_package ?? notes.package_type ?? '';
    if (!packageRaw) return NextResponse.json({ received: true });
    slugs = packageToSlugs(packageRaw);
  }

  if (slugs.length === 0) return NextResponse.json({ received: true });

  const name  = notes.client_name  ?? notes.name  ?? 'Client';
  const email = notes.client_email ?? notes.email ?? '';
  const phone = notes.client_phone ?? notes.phone ?? null;

  if (!email) return NextResponse.json({ error: 'No email in payment notes' }, { status: 400 });

  // Idempotency
  const existing = await db.careerClient.findUnique({ where: { razorpayPaymentId: payment.id } });
  if (existing) return NextResponse.json({ received: true });

  const serviceRecords = await resolveServices(slugs);
  const magicToken  = generateMagicToken();
  const tokenExpiry = magicTokenExpiry();

  const client = await db.careerClient.upsert({
    where: { email },
    create: {
      name, email, phone,
      amountPaid: payment.amount / 100,
      currency: payment.currency,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id ?? null,
      magicToken,
      magicTokenExpiry: tokenExpiry,
      services: {
        create: serviceRecords.map(s => ({ serviceId: s.id })),
      },
      activityLogs: {
        create: {
          action: 'client_created',
          performedBy: 'system',
          metadata: { trigger: 'razorpay_webhook', paymentId: payment.id, services: slugs },
        },
      },
    },
    update: {
      amountPaid: payment.amount / 100,
      razorpayPaymentId: payment.id,
      magicToken,
      magicTokenExpiry: tokenExpiry,
    },
  });

  // Sync services for returning clients
  for (const s of serviceRecords) {
    await db.careerClientService.upsert({
      where: { clientId_serviceId: { clientId: client.id, serviceId: s.id } },
      create: { clientId: client.id, serviceId: s.id },
      update: {},
    });
  }

  const serviceNames = serviceRecords.map(s => s.name).join(', ');
  const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;

  // Fire admin alert immediately (fire-and-forget)
  waitUntil(
    sendAdminPaymentAlert({
      clientName: client.name,
      clientEmail: email,
      product: serviceNames || 'Career Services',
      amount: payment.amount / 100,
      currency: payment.currency ?? 'INR',
      currencySymbol: payment.currency === 'USD' ? '$' : payment.currency === 'GBP' ? '£' : '₹',
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id ?? null,
      brandId: 'catalyst',
      adminUrl: `${PORTAL_URL}/career/${client.id}`,
    }).catch(err => console.error('[career/webhook] Admin alert failed:', err))
  );

  waitUntil(
    (async () => {
      try {
        const resendId = await sendCareerEmail({
          to: email,
          trigger: 'WELCOME',
          data: { name: client.name, packageLabel: serviceNames, portalUrl },
        });
        await db.careerEmailLog.create({
          data: { clientId: client.id, trigger: 'WELCOME', resendId, status: 'sent' },
        });
      } catch (emailErr) {
        console.error('[career/webhook] Welcome email failed:', emailErr);
        await db.careerEmailLog.create({
          data: {
            clientId: client.id,
            trigger: 'WELCOME',
            status: 'failed',
            metadata: { error: String(emailErr) },
          },
        });
      }
    })()
  );

  return NextResponse.json({ received: true });
}
