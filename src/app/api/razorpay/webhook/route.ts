// src/app/api/razorpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

import { prisma } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import { rnOnboardFromInvoice } from '@/lib/rn/onboarding';
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
  const eventId = request.headers.get('x-razorpay-event-id') ?? `razorpay-${Date.now()}`;
  console.log('Razorpay webhook event:', event, 'ID:', eventId);

  // Idempotency check
  if (eventId && !eventId.startsWith('razorpay-')) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: 'RAZORPAY',
          eventId: eventId,
          eventType: event,
          payload: payload,
          status: 'PROCESSED'
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log(`Webhook ${eventId} already processed, skipping.`);
        return NextResponse.json({ received: true });
      }
      // If it's another DB error, log it but let it crash so Razorpay retries
      throw e;
    }
  }

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
        ...(existing.installmentPlan && installmentSeq !== null ? { 
          installments: updatedInstallments as object[],
          invoiceInstallments: {
            updateMany: {
              where: { seq: installmentSeq },
              data: { status: 'PAID', paidAt: new Date() }
            }
          }
        } : {}),

      },
    });

    if (newStatus === 'PAID') {
      waitUntil(
        sendPaymentConfirmationEmail(invoice as any)
          .catch(err => console.error('Confirmation email failed:', err))
      );
      
      if (invoice.brandId === 'ripple_nexus') {
        waitUntil(
          rnOnboardFromInvoice(invoice as any)
            .catch(err => console.error('[webhook] RN onboarding failed:', err))
        );
      } else {
        waitUntil(
          onboardFromInvoice({ ...invoice, razorpayPaymentId })
            .catch(async (err) => {
              console.error('[webhook] Career onboarding failed:', err);
              const { sendCareerEmail } = await import('@/lib/career/email');
              const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com';
              await sendCareerEmail({
                to: adminEmail,
                trigger: 'MESSAGE_NOTIFY',
                data: {
                  recipientName: 'Catalyst Team',
                  senderType: 'admin',
                  portalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com'}/career`,
                  body: `⚠️ ONBOARDING FAILED for ${invoice.clientEmail} (Invoice ${invoice.id}). Error: ${String(err)}. Manual action required.`,
                },
              }).catch(console.error);
            })
        );
      }
    }

  }

  // ── PAYMENT LINK EXPIRED ─────────────────────────────────────
  if (event === 'payment_link.expired') {
    const paymentLink = payload.payload.payment_link?.entity;
    const invoiceId   = paymentLink?.notes?.invoice_id as string | undefined;
    if (invoiceId) {
      const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (existing) {
        if (existing.installmentPlan) {
          const installmentSeq = paymentLink?.notes?.installment_seq
            ? parseInt(paymentLink.notes.installment_seq as string, 10)
            : null;
          if (installmentSeq !== null) {
            const updatedInstallments = (existing.installments as unknown as Installment[]).map(inst =>
              inst.seq === installmentSeq && inst.status !== 'PAID'
                ? { ...inst, status: 'EXPIRED' as const }
                : inst
            );
            await prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                installments: updatedInstallments as object[],
                invoiceInstallments: {
                  updateMany: {
                    where: { seq: installmentSeq },
                    data: { status: 'EXPIRED' }
                  }
                }
              }
            });
          }
        } else if (existing.status === 'PENDING') {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'EXPIRED' }
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
