// src/app/api/paypal/webhook/route.ts
// Handle PayPal invoice payment webhooks
// Configure in PayPal Dashboard → Webhooks:
//   https://catalyst.theripplenexus.com/api/paypal/webhook
// Subscribe to: INVOICES.PAYMENT.COMPLETED, INVOICES.CANCELLED

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPaypalWebhook } from '@/lib/paypal';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import { sendCareerEmail } from '@/lib/career/email';
import { ADMIN_EMAIL } from '@/lib/config';
import { waitUntil } from '@vercel/functions';
import type { Installment } from '@/types';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const headers: Record<string, string | null> = {
    'paypal-transmission-id':   request.headers.get('paypal-transmission-id'),
    'paypal-transmission-time': request.headers.get('paypal-transmission-time'),
    'paypal-cert-url':          request.headers.get('paypal-cert-url'),
    'paypal-auth-algo':         request.headers.get('paypal-auth-algo'),
    'paypal-transmission-sig':  request.headers.get('paypal-transmission-sig'),
  };

  // Verification is MANDATORY. Reject if PAYPAL_WEBHOOK_ID is not configured.
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    console.error('[PayPal webhook] PAYPAL_WEBHOOK_ID is not set — rejecting all PayPal webhooks');
    return NextResponse.json(
      { error: 'PayPal webhook not configured on this server' },
      { status: 500 },
    );
  }

  const valid = await verifyPaypalWebhook(headers, rawBody).catch(() => false);
  if (!valid) {
    console.error('[PayPal webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const eventType = payload.event_type as string;
  console.log('[PayPal webhook] event:', eventType);

  // ── PAYMENT COMPLETED ────────────────────────────────────────
  if (
    eventType === 'INVOICES.PAYMENT.COMPLETED' ||
    eventType === 'INVOICES.PAYMENT.REGISTERED'
  ) {
    const resource        = payload.resource as Record<string, unknown> | undefined;
    const paypalInvoiceId = resource?.id as string | undefined;
    if (!paypalInvoiceId) return NextResponse.json({ error: 'No invoice id in payload' }, { status: 400 });

    const topLevelInvoice = await prisma.invoice.findFirst({ where: { paypalInvoiceId } });

    if (topLevelInvoice) {
      if (topLevelInvoice.status === 'PAID') return NextResponse.json({ received: true });

      const updatedInvoice = await prisma.invoice.update({
        where: { id: topLevelInvoice.id },
        data:  { status: 'PAID', paidAt: new Date() },
      });

      waitUntil(
        sendPaymentConfirmationEmail(updatedInvoice as any)
          .catch(err => console.error('[PayPal webhook] Confirmation email failed:', err))
      );

      waitUntil(
        onboardFromInvoice(updatedInvoice)
          .catch(async (err) => {
            console.error('[PayPal webhook] Career onboarding failed:', err);
            sendCareerEmail({
              to: ADMIN_EMAIL,
              trigger: 'MESSAGE_NOTIFY',
              data: {
                recipientName: 'Catalyst Team',
                senderType: 'admin',
                portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/career`,
                body: `⚠️ ONBOARDING FAILED for ${updatedInvoice.clientEmail} (Invoice ${updatedInvoice.id}). Error: ${String(err)}. Manual action required.`,
              },
            }).catch(console.error);
          })
      );

    } else {
      // Check if it matches an instalment's paypalInvoiceId
      // PostgreSQL doesn't support array_contains with path on JSON columns in Prisma
      // Fetch pending split invoices and filter in-memory
      const splitInvoices = await prisma.invoice.findMany({
        where: { installmentPlan: true, status: { not: 'PAID' } },
      });
      const splitInvoice = splitInvoices.find(inv => {
        const installs = inv.installments as unknown as Installment[];
        return Array.isArray(installs) && installs.some(i => i.paypalInvoiceId === paypalInvoiceId);
      });

      if (!splitInvoice) {
        console.warn('[PayPal webhook] No invoice found for paypalInvoiceId:', paypalInvoiceId);
        return NextResponse.json({ received: true });
      }

      if (splitInvoice.status === 'PAID') return NextResponse.json({ received: true });

      const installs = (splitInvoice.installments as unknown as Installment[]).map(inst =>
        inst.paypalInvoiceId === paypalInvoiceId
          ? { ...inst, status: 'PAID' as const, paidAt: new Date().toISOString() }
          : inst
      );

      const allPaid   = installs.every(i => i.status === 'PAID');
      const newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await prisma.invoice.update({
        where: { id: splitInvoice.id },
        data:  {
          status:       newStatus,
          installments: installs as object[],
          ...(allPaid ? { paidAt: new Date() } : {}),
        },
      });

      if (allPaid) {
        waitUntil(
          sendPaymentConfirmationEmail(updatedInvoice as any)
            .catch(err => console.error('[PayPal webhook] Confirmation email failed:', err))
        );

        waitUntil(
          onboardFromInvoice(updatedInvoice)
            .catch(async (err) => {
              console.error('[PayPal webhook] Career onboarding failed:', err);
              sendCareerEmail({
                to: ADMIN_EMAIL,
                trigger: 'MESSAGE_NOTIFY',
                data: {
                  recipientName: 'Catalyst Team',
                  senderType: 'admin',
                  portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/career`,
                  body: `⚠️ ONBOARDING FAILED for ${updatedInvoice.clientEmail} (Invoice ${updatedInvoice.id}). Error: ${String(err)}. Manual action required.`,
                },
              }).catch(console.error);
            })
        );
      }
    }
  }

  // ── INVOICE CANCELLED ────────────────────────────────────────
  if (eventType === 'INVOICES.CANCELLED') {
    const resource        = payload.resource as Record<string, unknown> | undefined;
    const paypalInvoiceId = resource?.id as string | undefined;
    if (paypalInvoiceId) {
      await prisma.invoice.updateMany({
        where: { paypalInvoiceId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        data:  { status: 'CANCELLED' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
