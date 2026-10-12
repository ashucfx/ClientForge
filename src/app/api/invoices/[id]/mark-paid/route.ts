// src/app/api/invoices/[id]/mark-paid/route.ts
// Admin-only: manually mark an invoice as paid, or sync status from gateway.
// Supports both Razorpay and PayPal gateways.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchPaymentLinkStatus } from '@/lib/razorpay';
import { fetchPaypalInvoiceStatus } from '@/lib/paypal';
import { sendPaymentConfirmationEmail, sendAdminPaymentAlert } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
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
          
          const updatedInvoice = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${params.id} FOR UPDATE`;
            const current = await tx.invoice.findUniqueOrThrow({ where: { id: params.id } });
            if (current.status === 'PAID') return null;

            const paidSeqs = installs
              .filter(inst => inst.status === 'PAID')
              .map(inst => inst.seq);
            const claimed = await tx.invoiceInstallment.updateMany({
              where: { invoiceId: params.id, seq: { in: paidSeqs }, status: { not: 'PAID' } },
              data: { status: 'PAID', paidAt: new Date() },
            });
            if (claimed.count === 0) return null;

            const currentInstallments = (current.installments as unknown as Installment[]).map(inst =>
              paidSeqs.includes(inst.seq)
                ? { ...inst, status: 'PAID' as const, paidAt: new Date().toISOString() }
                : inst
            );
            const relationalInstallments = await tx.invoiceInstallment.findMany({
              where: { invoiceId: params.id },
              select: { status: true },
            });
            const currentStatus = relationalInstallments.every(inst => inst.status === 'PAID')
              ? 'PAID'
              : 'PARTIALLY_PAID';

            return tx.invoice.update({
              where: { id: params.id },
              data: {
                status: currentStatus,
                installments: currentInstallments as object[],
                ...(currentStatus === 'PAID' ? { paidAt: new Date() } : {}),
              },
            });
          });
          if (!updatedInvoice) {
            return NextResponse.json({ synced: false, message: 'No installments changed status', invoice });
          }

          if (updatedInvoice.status === 'PAID') {
            sendPaymentConfirmationEmail(updatedInvoice as any).catch((err: any) => console.error(err));
            onboardFromInvoice(updatedInvoice).catch((err: any) => console.error(err));
          }

          return NextResponse.json({ synced: true, newStatus: updatedInvoice.status, invoice: updatedInvoice });
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
        
      sendAdminPaymentAlert({
        clientName: updatedInvoice.clientName,
        clientEmail: updatedInvoice.clientEmail,
        product: 'Invoice Payment (Synced)',
        amount: updatedInvoice.totalPayable,
        currency: updatedInvoice.currency,
        currencySymbol: updatedInvoice.currencySymbol,
        invoiceNumber: updatedInvoice.invoiceNumber,
        invoiceId: updatedInvoice.id,
        brandId: updatedInvoice.brandId ?? 'catalyst',
      }).catch(err => console.error('[mark-paid/sync] Admin alert failed:', err));

      onboardFromInvoice(updatedInvoice)
        .catch(err => console.error('[mark-paid/sync] Career onboarding failed:', err));
    }

    prisma.auditLog.create({
      data: {
        tenantId: updatedInvoice.brandId ?? 'system',
        adminId:  session.adminId,
        action:   `INVOICE_SYNC_${newStatus}`,
        entity:   'Invoice',
        entityId: params.id,
        changes:  { before: { status: invoice.status }, after: { status: newStatus }, gateway: gatewayLabel },
      },
    }).catch(() => null);

    return NextResponse.json({ synced: true, newStatus, invoice: updatedInvoice });
  }

  // ── MANUAL MARK AS PAID ────────────────────────────────────
  if (invoice.status === 'PAID') {
    return NextResponse.json({ error: 'Invoice is already marked as paid' }, { status: 400 });
  }

  const claimed = await prisma.invoice.updateMany({
    where: { id: params.id, status: { not: 'PAID' } },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: 'Invoice is already marked as paid' }, { status: 409 });
  }

  const updatedInvoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: params.id },
  });

  prisma.auditLog.create({
    data: {
      tenantId: invoice.brandId ?? 'system',
      adminId:  session.adminId,
      action:   'INVOICE_MARKED_PAID',
      entity:   'Invoice',
      entityId: params.id,
      changes:  { before: { status: invoice.status }, after: { status: 'PAID' } },
    },
  }).catch(() => null);

  // Send confirmation email + auto-onboard (best-effort, non-blocking)
  sendPaymentConfirmationEmail(updatedInvoice as any)
    .catch(err => console.error('[mark-paid/manual] Confirmation email failed:', err));
    
  sendAdminPaymentAlert({
    clientName: updatedInvoice.clientName,
    clientEmail: updatedInvoice.clientEmail,
    product: 'Invoice Payment (Manual)',
    amount: updatedInvoice.totalPayable,
    currency: updatedInvoice.currency,
    currencySymbol: updatedInvoice.currencySymbol,
    invoiceNumber: updatedInvoice.invoiceNumber,
    invoiceId: updatedInvoice.id,
    brandId: updatedInvoice.brandId ?? 'catalyst',
  }).catch(err => console.error('[mark-paid/manual] Admin alert failed:', err));
  
  onboardFromInvoice(updatedInvoice)
    .catch(err => console.error('[mark-paid/manual] Career onboarding failed:', err));

  // If this invoice belongs to an out-of-scope/paid CareerRevision, activate it
  syncRevisionOnPayment(updatedInvoice.id).catch(err => console.error('[mark-paid] syncRevisionOnPayment failed:', err));

  return NextResponse.json({ ok: true, invoice: updatedInvoice });
}

async function syncRevisionOnPayment(invoiceId: string) {
  try {
    const revision = await prisma.careerRevision.findFirst({
      where: { invoiceId },
    });
    if (revision) {
      await prisma.careerRevision.update({
        where: { id: revision.id },
        data: {
          chargeStatus: 'PAID',
          status: 'UNDER_PROCESS',
        },
      });
      await prisma.careerClient.update({
        where: { id: revision.clientId },
        data: { status: 'UNDER_PROCESS', waitingOn: 'AGENCY' },
      });
      await prisma.careerActivityLog.create({
        data: {
          clientId: revision.clientId,
          action: 'revision_payment_completed',
          performedBy: 'system',
          metadata: { revisionId: revision.id, invoiceId },
        },
      });
    }
  } catch (err) {
    console.warn('[syncRevisionOnPayment] error:', err);
  }
}
