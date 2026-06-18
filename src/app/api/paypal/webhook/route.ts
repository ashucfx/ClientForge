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
import { sendPaymentConfirmationEmail, sendAdminPaymentAlert } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import { rnOnboardFromInvoice } from '@/lib/rn/onboarding';
import { sendCareerEmail } from '@/lib/career/email';
import { ADMIN_EMAIL } from '@/lib/config';
import { waitUntil } from '@vercel/functions';
import type { Installment } from '@/types';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

export async function POST(request: NextRequest) {
  if (!PAYPAL_WEBHOOK_ID) {
    console.error('CRITICAL ERROR: PAYPAL_WEBHOOK_ID is not configured.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const rawBody = await request.text();

  const headers: Record<string, string | null> = {
    'paypal-transmission-id':   request.headers.get('paypal-transmission-id'),
    'paypal-transmission-time': request.headers.get('paypal-transmission-time'),
    'paypal-cert-url':          request.headers.get('paypal-cert-url'),
    'paypal-auth-algo':         request.headers.get('paypal-auth-algo'),
    'paypal-transmission-sig':  request.headers.get('paypal-transmission-sig'),
  };

  const valid = await verifyPaypalWebhook(headers, rawBody).catch(() => false);
  if (!valid) {
    console.error('[PayPal webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const eventType = payload.event_type as string;
  const eventId = payload.id as string || headers['paypal-transmission-id'] as string;
  console.log('[PayPal webhook] event:', eventType, 'id:', eventId);

  // ── IDEMPOTENCY CHECK (two-phase: PENDING → PROCESSED) ─────────────────────
  let webhookRecorded = false;
  if (eventId) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: 'PAYPAL',
          eventId,
          eventType,
          payload: payload as object,
          status: 'PENDING',
        },
      });
      webhookRecorded = true;
    } catch (err: any) {
      if (err.code === 'P2002') {
        const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
        if (existing?.status === 'PROCESSED') {
          console.log(`[PayPal webhook] Duplicate event skipped: ${eventId}`);
          return NextResponse.json({ received: true, message: 'Duplicate event' });
        }
        // PENDING or FAILED — allow retry
        console.log(`[PayPal webhook] Retrying event ${eventId} (status: ${existing?.status})`);
        webhookRecorded = true;
      } else {
        console.error('[PayPal webhook] Failed to record WebhookEvent:', err);
      }
    }
  }

  try {
    // ── PAYMENT COMPLETED ──────────────────────────────────────────────────────
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

        const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';
        waitUntil(
          sendAdminPaymentAlert({
            clientName: (updatedInvoice as any).clientName,
            clientEmail: (updatedInvoice as any).clientEmail,
            product: 'Service',
            amount: (updatedInvoice as any).totalPayable,
            currency: (updatedInvoice as any).currency ?? 'USD',
            currencySymbol: (updatedInvoice as any).currency === 'INR' ? '₹' : (updatedInvoice as any).currency === 'GBP' ? '£' : '$',
            invoiceNumber: (updatedInvoice as any).invoiceNumber,
            invoiceId: updatedInvoice.id,
            brandId: updatedInvoice.brandId ?? 'catalyst',
            adminUrl: `${PORTAL_URL}/invoices/${updatedInvoice.id}`,
          }).catch(err => console.error('[PayPal webhook] Admin alert failed:', err))
        );

        if (updatedInvoice.brandId === 'ripple_nexus') {
          waitUntil(
            rnOnboardFromInvoice(updatedInvoice as any)
              .catch(err => console.error('[PayPal webhook] RN onboarding failed:', err))
          );
        } else {
          waitUntil(
            onboardFromInvoice(updatedInvoice)
              .then(async (result) => {
                const { handleSalesFunnelPayment } = await import('@/lib/sales/paymentHooks');
                await handleSalesFunnelPayment(updatedInvoice.id, result.clientId);
              })
              .catch(async (err) => {
                console.error('[PayPal webhook] Career onboarding failed:', err);
                sendCareerEmail({
                  to: ADMIN_EMAIL,
                  trigger: 'MESSAGE_NOTIFY',
                  data: {
                    recipientName: 'Catalyst Team',
                    senderType: 'admin',
                    portalUrl: `${PORTAL_URL}/career`,
                    body: `⚠️ ONBOARDING FAILED for ${updatedInvoice.clientEmail} (Invoice ${updatedInvoice.id}). Error: ${String(err)}. Manual action required.`,
                  },
                }).catch(console.error);
              })
          );
        }
      } else {
        // ── Installment payment — direct indexed lookup (no table scan) ──────
        const installmentRow = await prisma.invoiceInstallment.findFirst({
          where:   { paypalInvoiceId },
          include: { invoice: true },
        });

        if (!installmentRow) {
          console.warn('[PayPal webhook] No InvoiceInstallment found for paypalInvoiceId:', paypalInvoiceId);
          return NextResponse.json({ received: true });
        }

        if (installmentRow.invoice.status === 'PAID') return NextResponse.json({ received: true });

        // Atomic update: mark this installment paid and check if all are done
        const updatedInvoice = await prisma.$transaction(async (tx) => {
          await tx.invoiceInstallment.update({
            where: { id: installmentRow.id },
            data:  { status: 'PAID', paidAt: new Date() },
          });

          const allInstallments = await tx.invoiceInstallment.findMany({
            where:  { invoiceId: installmentRow.invoiceId },
            select: { status: true },
          });
          const allPaid   = allInstallments.every(i => i.status === 'PAID');
          const newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';

          const paidAt = new Date().toISOString();
          const updatedInstalls = (installmentRow.invoice.installments as unknown as Installment[]).map(inst =>
            inst.paypalInvoiceId === paypalInvoiceId
              ? { ...inst, status: 'PAID' as const, paidAt }
              : inst
          );

          return tx.invoice.update({
            where: { id: installmentRow.invoiceId },
            data:  {
              status:       newStatus,
              installments: updatedInstalls as object[],
              ...(allPaid ? { paidAt: new Date() } : {}),
            },
          });
        });

        const allPaid = updatedInvoice.status === 'PAID';

        if (allPaid) {
          waitUntil(
            sendPaymentConfirmationEmail(updatedInvoice as any)
              .catch(err => console.error('[PayPal webhook] Confirmation email failed:', err))
          );

          const PORTAL_URL2 = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';
          waitUntil(
            sendAdminPaymentAlert({
              clientName: (updatedInvoice as any).clientName,
              clientEmail: (updatedInvoice as any).clientEmail,
              product: 'Installment — Final Payment',
              amount: (updatedInvoice as any).totalPayable,
              currency: (updatedInvoice as any).currency ?? 'USD',
              currencySymbol: (updatedInvoice as any).currency === 'INR' ? '₹' : (updatedInvoice as any).currency === 'GBP' ? '£' : '$',
              invoiceNumber: (updatedInvoice as any).invoiceNumber,
              invoiceId: updatedInvoice.id,
              brandId: updatedInvoice.brandId ?? 'catalyst',
              adminUrl: `${PORTAL_URL2}/invoices/${updatedInvoice.id}`,
            }).catch(err => console.error('[PayPal webhook] Admin alert failed:', err))
          );

          if (updatedInvoice.brandId === 'ripple_nexus') {
            waitUntil(
              rnOnboardFromInvoice(updatedInvoice as any)
                .catch(err => console.error('[PayPal webhook] RN onboarding failed:', err))
            );
          } else {
            waitUntil(
              onboardFromInvoice(updatedInvoice)
                .then(async (result) => {
                  const { handleSalesFunnelPayment } = await import('@/lib/sales/paymentHooks');
                  await handleSalesFunnelPayment(updatedInvoice.id, result.clientId);
                })
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
    }

    // ── INVOICE CANCELLED ──────────────────────────────────────────────────────
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

    // Mark event successfully processed
    if (webhookRecorded && eventId) {
      await prisma.webhookEvent.update({
        where: { eventId },
        data:  { status: 'PROCESSED' },
      }).catch(e => console.error('[PayPal webhook] Failed to update webhook status:', e));
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[PayPal webhook] Processing error:', error);
    if (webhookRecorded && eventId) {
      await prisma.webhookEvent.update({
        where: { eventId },
        data:  { status: 'FAILED', error: String(error) },
      }).catch(() => null);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
