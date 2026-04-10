// src/app/api/career/webhook/route.ts
// Razorpay webhook for Career Booster — creates client + triggers welcome email

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma as db } from '@/lib/db';
import { generateMagicToken, magicTokenExpiry } from '@/lib/career/auth';
import { sendCareerEmail } from '@/lib/career/email';
import { PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage } from '@/lib/career/types';

const WEBHOOK_SECRET = process.env.RAZORPAY_CAREER_WEBHOOK_SECRET
  ?? process.env.RAZORPAY_WEBHOOK_SECRET!;

const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
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

  // Only handle career payments (check notes.module === 'career' or career_package present)
  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true });
  }

  const payment = event.payload.payment?.entity;
  if (!payment) return NextResponse.json({ received: true });

  const notes = payment.notes ?? {};
  const module = notes.module;
  const packageRaw = notes.career_package ?? notes.package_type ?? '';

  // Skip if not a career payment
  if (module && module !== 'career') return NextResponse.json({ received: true });
  if (!packageRaw) return NextResponse.json({ received: true });

  const packageType = packageRaw.toUpperCase() as CareerPackage;
  const validPackages: CareerPackage[] = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'FULL'];
  if (!validPackages.includes(packageType)) {
    return NextResponse.json({ received: true });
  }

  const name  = notes.client_name  ?? notes.name  ?? 'Client';
  const email = notes.client_email ?? notes.email ?? '';
  const phone = notes.client_phone ?? notes.phone ?? null;

  if (!email) return NextResponse.json({ error: 'No email in payment notes' }, { status: 400 });

  // Idempotency — skip if already processed
  const existing = await db.careerClient.findUnique({ where: { razorpayPaymentId: payment.id } });
  if (existing) return NextResponse.json({ received: true });

  const magicToken  = generateMagicToken();
  const tokenExpiry = magicTokenExpiry();

  // Upsert: if client already exists (re-purchase), update package + reset token
  const client = await db.careerClient.upsert({
    where: { email },
    create: {
      name, email, phone,
      packageType,
      amountPaid: payment.amount / 100,
      currency: payment.currency,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id ?? null,
      magicToken,
      magicTokenExpiry: tokenExpiry,
      activityLogs: {
        create: {
          action: 'client_created',
          performedBy: 'system',
          metadata: { trigger: 'razorpay_webhook', paymentId: payment.id },
        },
      },
    },
    update: {
      packageType,
      amountPaid: payment.amount / 100,
      razorpayPaymentId: payment.id,
      magicToken,
      magicTokenExpiry: tokenExpiry,
    },
  });

  // Send welcome email (non-blocking — log failure but don't fail webhook)
  try {
    const portalUrl = `${PORTAL_URL}/portal/login?token=${magicToken}`;
    const resendId = await sendCareerEmail({
      to: email,
      trigger: 'WELCOME',
      data: {
        name: client.name,
        packageLabel: PACKAGE_LABELS[packageType],
        portalUrl,
      },
    });

    await db.careerEmailLog.create({
      data: {
        clientId: client.id,
        trigger: 'WELCOME',
        resendId,
        status: 'sent',
      },
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

  return NextResponse.json({ received: true });
}
