import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, referenceNumber, transferDate } = body;

    if (!invoiceId || !referenceNumber || !transferDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if a request already exists
    const existing = await db.bankTransferRequest.findFirst({
      where: { invoiceId }
    });

    if (existing) {
      return NextResponse.json({ error: 'A reconciliation request already exists for this invoice.' }, { status: 400 });
    }

    const request = await db.bankTransferRequest.create({
      data: {
        invoiceId: invoice.id,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        currency: invoice.currency,
        amount: invoice.totalPayable,
        referenceNumber,
        transferDate: new Date(transferDate),
        status: 'PENDING',
      }
    });

    return NextResponse.json({ ok: true, request }, { status: 201 });
  } catch (err: any) {
    console.error('Reconciliation API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
