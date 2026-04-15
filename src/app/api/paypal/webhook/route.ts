// src/app/api/paypal/webhook/route.ts
// Handle PayPal invoice payment webhooks
// Configure this URL in PayPal Dashboard → Webhooks:
//   https://clientforge.theripplenexus.com/api/paypal/webhook
// Subscribe to event: INVOICES.PAYMENT.COMPLETED

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPaypalWebhook } from '@/lib/paypal';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Collect headers PayPal uses for signature verification
  const headers: Record<string, string | null> = {
    'paypal-transmission-id':   request.headers.get('paypal-transmission-id'),
    'paypal-transmission-time': request.headers.get('paypal-transmission-time'),
    'paypal-cert-url':          request.headers.get('paypal-cert-url'),
    'paypal-auth-algo':         request.headers.get('paypal-auth-algo'),
    'paypal-transmission-sig':  request.headers.get('paypal-transmission-sig'),
  };

  // Verify webhook authenticity via PayPal's own API
  // Skip in development if PAYPAL_WEBHOOK_ID is not set
  if (process.env.PAYPAL_WEBHOOK_ID) {
    const valid = await verifyPaypalWebhook(headers, rawBody).catch(() => false);
    if (!valid) {
      console.error('[PayPal webhook] Signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.event_type as string;
  console.log('[PayPal webhook] event:', eventType);

  // ── PAYMENT COMPLETED ────────────────────────────────────────
  if (
    eventType === 'INVOICES.PAYMENT.COMPLETED' ||
    eventType === 'INVOICES.PAYMENT.REGISTERED'
  ) {
    const resource = payload.resource as Record<string, unknown> | undefined;
    const paypalInvoiceId = resource?.id as string | undefined;

    if (!paypalInvoiceId) {
      return NextResponse.json({ error: 'No invoice id in payload' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { paypalInvoiceId },
    });

    if (!invoice) {
      console.warn('[PayPal webhook] No invoice found for paypalInvoiceId:', paypalInvoiceId);
      return NextResponse.json({ received: true }); // acknowledge — PayPal retries on non-2xx
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ received: true }); // idempotent
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data:  { status: 'PAID', paidAt: new Date() },
    });

    // Send confirmation email (non-blocking)
    sendPaymentConfirmationEmail(updatedInvoice as unknown as Parameters<typeof sendPaymentConfirmationEmail>[0])
      .catch(err => console.error('[PayPal webhook] Confirmation email failed:', err));

    // Auto-onboard career client (non-blocking)
    onboardFromInvoice(updatedInvoice)
      .catch(err => console.error('[PayPal webhook] Career onboarding failed:', err));
  }

  // ── INVOICE CANCELLED ────────────────────────────────────────
  if (eventType === 'INVOICES.CANCELLED') {
    const resource       = payload.resource as Record<string, unknown> | undefined;
    const paypalInvoiceId = resource?.id as string | undefined;
    if (paypalInvoiceId) {
      await prisma.invoice.updateMany({
        where: { paypalInvoiceId, status: 'PENDING' },
        data:  { status: 'CANCELLED' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
