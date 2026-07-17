import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { render } from '@react-email/render';
import { InvoiceEmail } from '@/emails/invoice/InvoiceEmail';
import { PaymentConfirmationEmail } from '@/emails/invoice/PaymentConfirmationEmail';
import * as React from 'react';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return new NextResponse('Unauthorized', { status: 401 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) return new NextResponse('Not found', { status: 404 });

    let html = '';
    
    const invoiceData = invoice as unknown as import('@/types').InvoiceData;

    if (invoice.status === 'PAID') {
      html = await render(React.createElement(PaymentConfirmationEmail, { invoice: invoiceData }) as any);
    } else {
      html = await render(React.createElement(InvoiceEmail, { invoice: invoiceData }) as any);
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err) {
    console.error(err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
