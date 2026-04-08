// src/app/api/razorpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { sendSMS, buildPaymentConfirmationSMS } from '@/lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  // Verify webhook signature
  if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event;

  console.log('Razorpay webhook event:', event);

  if (event === 'payment_link.paid') {
    const paymentLink = payload.payload.payment_link?.entity;
    const payment = payload.payload.payment?.entity;

    if (!paymentLink) {
      return NextResponse.json({ error: 'No payment link entity' }, { status: 400 });
    }

    const invoiceId = paymentLink.notes?.invoice_id;
    const razorpayPaymentId = payment?.id;

    if (!invoiceId) {
      console.error('No invoice_id in payment link notes');
      return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    // Update invoice status
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        razorpayPaymentId,
        paidAt: new Date(),
      },
    });

    // Send confirmation email
    try {
      await sendPaymentConfirmationEmail(invoice as any);
    } catch (err) {
      console.error('Confirmation email failed:', err);
    }

    // Send confirmation SMS
    try {
      const smsBody = buildPaymentConfirmationSMS(invoice as any);
      await sendSMS(invoice.clientPhone, smsBody);
    } catch (err) {
      console.error('Confirmation SMS failed:', err);
    }
  }

  if (event === 'payment_link.expired') {
    const paymentLink = payload.payload.payment_link?.entity;
    const invoiceId = paymentLink?.notes?.invoice_id;

    if (invoiceId) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'EXPIRED' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
