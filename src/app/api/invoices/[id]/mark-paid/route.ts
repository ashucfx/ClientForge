// src/app/api/invoices/[id]/mark-paid/route.ts
// Admin-only: manually mark an invoice as paid (fallback when Razorpay webhook fails)
// Also handles "Sync with Razorpay" by fetching live status from Razorpay API.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchPaymentLinkStatus } from '@/lib/razorpay';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = (body?.action as string) ?? 'mark_paid'; // 'mark_paid' | 'sync'

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  // ── SYNC with Razorpay ──────────────────────────────────────
  if (action === 'sync') {
    if (!invoice.razorpayLinkId) {
      return NextResponse.json({ error: 'No Razorpay link on this invoice' }, { status: 400 });
    }

    let rzData: Record<string, unknown>;
    try {
      rzData = await fetchPaymentLinkStatus(invoice.razorpayLinkId);
    } catch {
      return NextResponse.json({ error: 'Failed to reach Razorpay' }, { status: 502 });
    }

    const rzStatus = (rzData.status as string)?.toLowerCase();
    // Razorpay statuses: created, partially_paid, paid, cancelled, expired
    const newStatus =
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

    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    // Send confirmation email + auto-onboard if newly PAID
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
