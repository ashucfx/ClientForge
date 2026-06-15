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
import { rnOnboardFromInvoice } from '@/lib/rn/onboarding';
import type { Installment } from '@/types';

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
        if (invoice.installmentPlan) {
          const installs = (invoice.installments as unknown as Installment[]) || [];
          let allPaid = true;
          let changed = false;
          
          for (const inst of installs) {
            if (inst.status !== 'PAID' && inst.paypalInvoiceId) {
              const { normalizedStatus } = await fetchPaypalInvoiceStatus(inst.paypalInvoiceId);
              if (normalizedStatus === 'PAID') {
                inst.status = 'PAID';
                inst.paidAt = new Date().toISOString();
                changed = true;
              } else {
                allPaid = false;
              }
            } else if (inst.status !== 'PAID') {
              allPaid = false;
            }
          }
          
          if (!changed) {
            return NextResponse.json({ synced: false, message: 'No installments changed status', invoice });
          }
          
          newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';
          
          const updatedInvoice = await prisma.invoice.update({
            where: { id: params.id },
            data: {
              status: newStatus as 'PAID' | 'PARTIALLY_PAID',
              installments: installs as object[],
              ...(allPaid ? { paidAt: new Date() } : {}),
            },
          });
          
          if (allPaid) {
            sendPaymentConfirmationEmail(updatedInvoice as any).catch(err => console.error(err));
            if (updatedInvoice.brandId === 'ripple_nexus') {
              rnOnboardFromInvoice(updatedInvoice as any).catch(err => console.error(err));
            } else {
              onboardFromInvoice(updatedInvoice).catch(err => console.error(err));
            }
          }
          
          return NextResponse.json({ synced: true, newStatus, invoice: updatedInvoice });
        } else {
          const { normalizedStatus, rawStatus } = await fetchPaypalInvoiceStatus(invoice.paypalInvoiceId!);
          newStatus = normalizedStatus;
          if (!newStatus || newStatus === invoice.status) {
            return NextResponse.json({
              synced: false,
              message: `PayPal status is "${rawStatus}" — no change needed`,
              invoice,
            });
          }
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
      sendPaymentConfirmationEmail(updatedInvoice as any)
        .catch(err => console.error('[mark-paid/sync] Confirmation email failed:', err));
      if (updatedInvoice.brandId === 'ripple_nexus') {
        rnOnboardFromInvoice(updatedInvoice as any)
          .catch(err => console.error('[mark-paid/sync] RN onboarding failed:', err));
      } else {
        onboardFromInvoice(updatedInvoice)
          .catch(err => console.error('[mark-paid/sync] Career onboarding failed:', err));
      }
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
  sendPaymentConfirmationEmail(updatedInvoice as any)
    .catch(err => console.error('[mark-paid/manual] Confirmation email failed:', err));
  
  if (updatedInvoice.brandId === 'ripple_nexus') {
    rnOnboardFromInvoice(updatedInvoice as any)
      .catch(err => console.error('[mark-paid/manual] RN onboarding failed:', err));
  } else {
    onboardFromInvoice(updatedInvoice)
      .catch(err => console.error('[mark-paid/manual] Career onboarding failed:', err));
  }

  return NextResponse.json({ ok: true, invoice: updatedInvoice });
}
