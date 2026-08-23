import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import { rnOnboardFromInvoice } from '@/lib/rn/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const request = await db.bankTransferRequest.findUnique({
      where: { id: params.id }
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: request.invoiceId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Associated invoice not found' }, { status: 404 });
    }

    if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Wrap in a transaction to ensure atomic update
    const result = await db.$transaction(async (tx) => {
      // 1. Mark request as VERIFIED
      const updatedReq = await tx.bankTransferRequest.update({
        where: { id: request.id },
        data: { status: 'VERIFIED' }
      });

      // 2. Mark Invoice as PAID
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          amountSettledInr: 0, // Admin can edit this later
          settlementNote: `Manually verified via bank transfer ref: ${request.referenceNumber}`
        }
      });

      return { updatedReq, updatedInvoice };
    });

    // 3. Trigger async side-effects
    sendPaymentConfirmationEmail(result.updatedInvoice as any).catch(err => console.error(err));
    if (result.updatedInvoice.brandId === 'ripple_nexus') {
      rnOnboardFromInvoice(result.updatedInvoice as any).catch(err => console.error(err));
    } else {
      onboardFromInvoice(result.updatedInvoice as any).catch(err => console.error(err));
    }

    return NextResponse.json({ ok: true, request: result.updatedReq });
  } catch (err: any) {
    console.error('Verify error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
