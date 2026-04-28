// src/app/api/health/route.ts
// Production readiness check — validates env vars and DB connectivity.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'RESEND_API_KEY',
  'CAREER_PORTAL_SECRET',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

export async function GET() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);

  if (missing.length > 0) {
    return NextResponse.json(
      { status: 'degraded', missing, message: 'Required environment variables not set' },
      { status: 500 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', message: 'Database unreachable', error: String(err) },
      { status: 500 },
    );
  }

  // Warn about optional but important vars
  const warnings: string[] = [];
  if (!process.env.PAYPAL_WEBHOOK_ID) warnings.push('PAYPAL_WEBHOOK_ID not set — PayPal webhooks will be rejected');
  if (!process.env.ADMIN_NOTIFY_EMAIL) warnings.push('ADMIN_NOTIFY_EMAIL not set — using fallback address');
  if (!process.env.RAZORPAY_CAREER_WEBHOOK_SECRET) warnings.push('RAZORPAY_CAREER_WEBHOOK_SECRET not set — sharing main webhook secret');

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
