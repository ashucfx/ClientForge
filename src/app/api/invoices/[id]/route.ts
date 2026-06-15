// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cancelRazorpayPaymentLink, createRazorpayPaymentLink } from '@/lib/razorpay';
import { cancelPaypalInvoice, createPaypalInvoice } from '@/lib/paypal';
import { calculatePricing, round2 } from '@/lib/pricing';
import type { LineItem, Installment } from '@/types';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET — fetch single invoice
// ─────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ invoice });
}

// ─────────────────────────────────────────────
// PATCH — update pricing / notes / status
// If pricing changes and invoice is PENDING → cancel old Razorpay link + create new one
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();

    const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(existing.brandId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If pricing fields are being updated, recalculate all derived amounts
    const pricingChanged =
      body.resumeBaseInr   !== undefined ||
      body.linkedinBaseInr !== undefined ||
      body.lineItems       !== undefined;

    const allowedFields = [
      'clientName', 'clientEmail', 'clientPhone', 'companyName',
      'dueDate', 'notes', 'status', 'resumeBaseInr', 'linkedinBaseInr',
      'revisionCharge', 'lineItems'
    ];
    let updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (pricingChanged && existing.status === 'PENDING') {
      let subtotalConverted = 0;
      let resumeConverted = 0;
      let linkedinConverted = 0;
      const newLineItems = (body.lineItems ?? existing.lineItems) as LineItem[];
      const hasLineItems = Array.isArray(newLineItems) && newLineItems.length > 0;

      if (hasLineItems) {
        subtotalConverted = newLineItems.reduce((acc: number, item: any) => acc + (item.qty * item.unitPrice), 0);
      } else {
        const newResumeInr   = body.resumeBaseInr   ?? existing.resumeBaseInr;
        const newLinkedinInr = body.linkedinBaseInr ?? existing.linkedinBaseInr;
        resumeConverted   = round2(newResumeInr   / existing.exchangeRate);
        linkedinConverted = round2(newLinkedinInr / existing.exchangeRate);
        subtotalConverted = round2((newResumeInr + newLinkedinInr) / existing.exchangeRate);
      }

      const discountAmount = round2(subtotalConverted * (existing.discountRate / 100));
      const afterDiscount = subtotalConverted - discountAmount;
      const taxAmount = round2(afterDiscount * (existing.taxRate / 100));
      const preFeeTotal = afterDiscount + taxAmount;
      const processingFee = round2(preFeeTotal * existing.processingFeeRate);
      const baseTotalPayable = round2(preFeeTotal + processingFee);

      // Include any revision charge already set
      const revisionCharge = body.revisionCharge ?? existing.revisionCharge ?? 0;
      const finalTotal     = round2(baseTotalPayable + round2(revisionCharge / existing.exchangeRate));

      updateData = {
        ...updateData,
        resumeConverted,
        linkedinConverted,
        subtotalConverted,
        discountAmount,
        taxAmount,
        processingFeeConverted: processingFee,
        totalPayable:           finalTotal,
        customPricing:          true,
      };

      const updatedInvoiceParams = {
        ...existing,
        ...updateData,
        totalPayable: finalTotal,
      };

      if (existing.paymentGateway === 'PAYPAL') {
        if (existing.paypalInvoiceId && !existing.installmentPlan) {
          await cancelPaypalInvoice(existing.paypalInvoiceId).catch(() => {});
        }
        if (!existing.installmentPlan) {
          try {
            const ppRes = await createPaypalInvoice({
              id: existing.id,
              invoiceNumber: existing.invoiceNumber,
              clientName: existing.clientName,
              clientEmail: existing.clientEmail,
              currency: existing.currency,
              dueDate: existing.dueDate,
              notes: existing.notes,
              lineItems: hasLineItems ? newLineItems : [],
              taxAmount: taxAmount,
              discountAmount: discountAmount,
              processingFeeAmount: processingFee,
            });
            updateData.paypalInvoiceId = ppRes.id;
            updateData.paypalPaymentUrl = ppRes.paymentUrl;
          } catch (ppErr) {
            console.error('Failed to recreate PayPal invoice after pricing update:', ppErr);
            updateData.paypalInvoiceId = null;
            updateData.paypalPaymentUrl = null;
          }
        }
      } else {
        if (existing.razorpayLinkId && !existing.installmentPlan) {
          await cancelRazorpayPaymentLink(existing.razorpayLinkId).catch(() => {});
        }
        if (!existing.installmentPlan) {
          try {
            const newLink = await createRazorpayPaymentLink(updatedInvoiceParams as any);
            updateData.razorpayLinkId  = newLink.id;
            updateData.razorpayLinkUrl = newLink.short_url;
          } catch (rzErr) {
            console.error('Failed to recreate Razorpay link after pricing update:', rzErr);
            updateData.razorpayLinkId  = null;
            updateData.razorpayLinkUrl = null;
          }
        }
      }
    }

    // Handle revision charge update (independent of pricing change)
    if (body.revisionCharge !== undefined && !pricingChanged) {
      const revisionConverted = round2(body.revisionCharge / existing.exchangeRate);
      const baseTotal = round2(existing.subtotalConverted + existing.processingFeeConverted);
      updateData.totalPayable = round2(baseTotal + revisionConverted);
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data:  updateData,
    });

    return NextResponse.json({ invoice });
  } catch (err) {
    console.error('PATCH invoice error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE — cancel Razorpay link then remove invoice
// ─────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancel the active payment link(s) (best-effort) before deletion
    if (invoice.status === 'PENDING') {
      if (invoice.installmentPlan) {
        const installs = (invoice.installments as unknown as Installment[]) || [];
        for (const inst of installs) {
          if (inst.status !== 'PAID' && inst.status !== 'CANCELLED') {
            if (invoice.paymentGateway === 'PAYPAL' && inst.paypalInvoiceId) {
              await cancelPaypalInvoice(inst.paypalInvoiceId).catch(() => {});
            } else if (invoice.paymentGateway === 'RAZORPAY' && inst.razorpayLinkId) {
              await cancelRazorpayPaymentLink(inst.razorpayLinkId).catch(() => {});
            }
          }
        }
      } else {
        if (invoice.paymentGateway === 'PAYPAL' && invoice.paypalInvoiceId) {
          await cancelPaypalInvoice(invoice.paypalInvoiceId).catch(() => {});
        } else if (invoice.razorpayLinkId) {
          await cancelRazorpayPaymentLink(invoice.razorpayLinkId).catch(() => {});
        }
      }
    }

    await prisma.invoice.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE invoice error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
