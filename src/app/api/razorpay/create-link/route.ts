// src/app/api/razorpay/create-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { isAdminRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/razorpay/create-link  { invoiceId }
// Used to (re)generate a payment link for an existing invoice
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { invoiceId } = await request.json();

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    const link = await createRazorpayPaymentLink(invoice as any);

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        razorpayLinkId: link.id,
        razorpayLinkUrl: link.short_url,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ linkId: link.id, linkUrl: link.short_url });
  } catch (err) {
    console.error('Create link error:', err);
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
  }
}
