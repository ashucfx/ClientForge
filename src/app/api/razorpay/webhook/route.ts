// src/app/api/razorpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import type { Installment } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const rawBody  = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const event   = payload.event;
  console.log('Razorpay webhook event:', event);

  // ── PAYMENT LINK PAID ────────────────────────────────────────
  if (event === 'payment_link.paid') {
    const paymentLink    = payload.payload.payment_link?.entity;
    const payment        = payload.payload.payment?.entity;
    if (!paymentLink) return NextResponse.json({ error: 'No payment link entity' }, { status: 400 });

    const invoiceId        = paymentLink.notes?.invoice_id as string | undefined;
    const installmentSeq   = paymentLink.notes?.installment_seq
      ? parseInt(paymentLink.notes.installment_seq as string, 10)
      : null;
    const razorpayPaymentId = payment?.id as string | undefined;

    if (!invoiceId) {
      console.error('No invoice_id in payment link notes');
      return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!existing) return NextResponse.json({ received: true });
    if (existing.status === 'PAID') return NextResponse.json({ received: true }); // idempotent

    let newStatus: 'PAID' | 'PARTIALLY_PAID' = 'PAID';
    let updatedInstallments = existing.installments as unknown as Installment[];

    if (existing.installmentPlan && installmentSeq !== null && Array.isArray(updatedInstallments)) {
      // Mark this instalment paid
      updatedInstallments = updatedInstallments.map(inst =>
        inst.seq === installmentSeq
          ? { ...inst, status: 'PAID' as const, paidAt: new Date().toISOString() }
          : inst
      );
      const allPaid = updatedInstallments.every(inst => inst.status === 'PAID');
      newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        razorpayPaymentId,
        ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
        ...(existing.installmentPlan ? { installments: updatedInstallments as object[] } : {}),
      },
    });

    if (newStatus === 'PAID') {
      sendPaymentConfirmationEmail(invoice as any)
        .catch(err => console.error('Confirmation email failed:', err));
      onboardFromInvoice({ ...invoice, razorpayPaymentId })
        .catch(err => console.error('[webhook] Career onboarding failed:', err));
    }
  }

  // ── PAYMENT LINK EXPIRED ─────────────────────────────────────
  if (event === 'payment_link.expired') {
    const paymentLink = payload.payload.payment_link?.entity;
    const invoiceId   = paymentLink?.notes?.invoice_id as string | undefined;
    if (invoiceId) {
      await prisma.invoice.updateMany({
        where: { id: invoiceId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        data:  { status: 'EXPIRED' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
