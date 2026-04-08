// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cancelRazorpayPaymentLink, createRazorpayPaymentLink } from '@/lib/razorpay';
import { calculatePricing, round2 } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET — fetch single invoice
// ─────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
    const body = await request.json();

    const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // If pricing fields are being updated, recalculate all derived amounts
    const pricingChanged =
      body.resumeBaseInr   !== undefined ||
      body.linkedinBaseInr !== undefined;

    let updateData: Record<string, unknown> = { ...body };

    if (pricingChanged && existing.status === 'PENDING') {
      const newResumeInr   = body.resumeBaseInr   ?? existing.resumeBaseInr;
      const newLinkedinInr = body.linkedinBaseInr  ?? existing.linkedinBaseInr;

      const resumeConverted   = round2(newResumeInr   / existing.exchangeRate);
      const linkedinConverted = round2(newLinkedinInr / existing.exchangeRate);
      const subtotalConverted = round2((newResumeInr + newLinkedinInr) / existing.exchangeRate);
      const processingFee     = round2(subtotalConverted * existing.processingFeeRate);
      const totalPayable      = round2(subtotalConverted + processingFee);

      // Include any revision charge already set
      const revisionCharge = body.revisionCharge ?? existing.revisionCharge ?? 0;
      const finalTotal     = round2(totalPayable + round2(revisionCharge / existing.exchangeRate));

      updateData = {
        ...updateData,
        resumeBaseInr:         newResumeInr,
        linkedinBaseInr:       newLinkedinInr,
        resumeConverted,
        linkedinConverted,
        subtotalConverted,
        processingFeeConverted: processingFee,
        totalPayable:           finalTotal,
        customPricing:          true,
      };

      // Cancel the old Razorpay link
      if (existing.razorpayLinkId) {
        await cancelRazorpayPaymentLink(existing.razorpayLinkId);
      }

      // Build a partial InvoiceData to create a new link
      const updatedInvoice = {
        ...existing,
        ...updateData,
        totalPayable: finalTotal,
      } as unknown as Parameters<typeof createRazorpayPaymentLink>[0];

      try {
        const newLink = await createRazorpayPaymentLink(updatedInvoice);
        updateData.razorpayLinkId  = newLink.id;
        updateData.razorpayLinkUrl = newLink.short_url;
      } catch (rzErr) {
        console.error('Failed to recreate Razorpay link after pricing update:', rzErr);
        // Don't block the save — clear stale link so UI doesn't show wrong link
        updateData.razorpayLinkId  = null;
        updateData.razorpayLinkUrl = null;
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
    const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // If there's a pending Razorpay link, cancel it first (best-effort)
    if (invoice.razorpayLinkId && invoice.status === 'PENDING') {
      await cancelRazorpayPaymentLink(invoice.razorpayLinkId);
    }

    await prisma.invoice.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE invoice error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
