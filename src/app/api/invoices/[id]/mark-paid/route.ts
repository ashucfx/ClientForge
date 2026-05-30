// src/app/api/invoices/[id]/mark-paid/route.ts
// Admin-only: manually mark an invoice as paid, or sync status from gateway.
// Supports both Razorpay and PayPal gateways.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchPaymentLinkStatus } from '@/lib/razorpay';
import { fetchPaypalInvoiceStatus } from '@/lib/paypal';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const action = (body?.action as string) ?? 'mark_paid'; // 'mark_paid' | 'sync'

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── SYNC with gateway ──────────────────────────────────────────
  if (action === 'sync') {
    const isPayPal = invoice.paymentGateway === 'PAYPAL';

    if (isPayPal && !invoice.paypalInvoiceId) {
      return NextResponse.json({ error: 'No PayPal invoice on this record' }, { status: 400 });
    }
    if (!isPayPal && !invoice.razorpayLinkId) {
      return NextResponse.json({ error: 'No Razorpay link on this invoice' }, { status: 400 });
    }

    let newStatus: string | null = null;
    let gatewayLabel = '';

    try {
      if (isPayPal) {
        gatewayLabel = 'PayPal';
        const { normalizedStatus, rawStatus } = await fetchPaypalInvoiceStatus(invoice.paypalInvoiceId!);
        newStatus = normalizedStatus;
        if (!newStatus || newStatus === invoice.status) {
          return NextResponse.json({
            synced: false,
            message: `PayPal status is "${rawStatus}" — no change needed`,
            invoice,
          });
        }
      } else {
        gatewayLabel = 'Razorpay';
        const rzData  = await fetchPaymentLinkStatus(invoice.razorpayLinkId!);
        const rzStatus = (rzData.status as string)?.toLowerCase();
        newStatus =
          rzStatus === 'paid'      ? 'PAID'      :
          rzStatus === 'cancelled' ? 'CANCELLED' :
          rzStatus === 'expired'   ? 'EXPIRED'   : null;
        if (!newStatus || newStatus === invoice.status) {
          return NextResponse.json({
            synced: false,
            message: `Razorpay status is "${rzStatus}" — no change needed`,
            invoice,
          });
        }
      }
    } catch {
      return NextResponse.json({ error: `Failed to reach ${gatewayLabel}` }, { status: 502 });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: newStatus as 'PAID' | 'CANCELLED' | 'EXPIRED',
        ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    if (newStatus === 'PAID') {
      sendPaymentConfirmationEmail(updatedInvoice as unknown as Parameters<typeof sendPaymentConfirmationEmail>[0])
        .catch(err => console.error('[mark-paid/sync] Confirmation email failed:', err));
      onboardFromInvoice(updatedInvoice)
        .catch(err => console.error('[mark-paid/sync] Career onboarding failed:', err));
    }

    return NextResponse.json({ synced: true, newStatus, invoice: updatedInvoice });
  }

  // ── MANUAL MARK AS PAID ────────────────────────────────────
  if (invoice.status === 'PAID') {
    return NextResponse.json({ error: 'Invoice is already marked as paid' }, { status: 400 });
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  // Send confirmation email + auto-onboard (best-effort, non-blocking)
  sendPaymentConfirmationEmail(updatedInvoice as unknown as Parameters<typeof sendPaymentConfirmationEmail>[0])
    .catch(err => console.error('[mark-paid/manual] Confirmation email failed:', err));
  onboardFromInvoice(updatedInvoice)
    .catch(err => console.error('[mark-paid/manual] Career onboarding failed:', err));

  return NextResponse.json({ ok: true, invoice: updatedInvoice });
}
