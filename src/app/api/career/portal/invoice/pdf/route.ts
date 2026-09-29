// src/app/api/career/portal/invoice/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { generatePaidInvoicePdfBuffer } from '@/lib/pdf/generateInvoicePdf';
import type { InvoiceData } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return new NextResponse('Unauthorized', { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      invoiceId: true,
      amountPaid: true,
      currency: true,
      packageType: true,
      status: true,
      createdAt: true,
      completedAt: true,
      contact: { select: { country: true } },
      services: { select: { service: { select: { name: true } } } },
    },
  });
  if (!client) return new NextResponse('Client not found', { status: 404 });

  let invoice: any = null;

  // 1. Check direct invoiceId
  if (client.invoiceId) {
    invoice = await db.invoice.findUnique({ where: { id: client.invoiceId } });
  }

  // 2. Check relational InvoiceClientLink
  if (!invoice) {
    const link = await db.invoiceClientLink.findFirst({
      where: { clientId: client.id },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
    });
    if (link?.invoice) invoice = link.invoice;
  }

  // 3. Check by client email (preferring PAID)
  if (!invoice) {
    invoice = await db.invoice.findFirst({
      where: {
        clientEmail: { equals: client.email, mode: 'insensitive' },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // 4. For completed/historical clients without an explicit DB invoice row, synthesize a valid tax receipt
  if (!invoice && (client.amountPaid > 0 || client.status === 'COMPLETED')) {
    const serviceNames = client.services?.map(s => s.service.name).join(', ') || client.packageType || 'Career Booster Services';
    invoice = {
      id: client.id,
      invoiceNumber: `CAT-${new Date(client.createdAt).getFullYear()}-${client.id.slice(-6).toUpperCase()}`,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone || '',
      clientType: client.packageType || 'MID_CAREER',
      country: client.contact?.country || 'India',
      currency: client.currency || 'INR',
      currencySymbol: client.currency === 'USD' ? '$' : '₹',
      exchangeRate: 1,
      lineItems: [
        {
          id: '1',
          description: serviceNames,
          qty: 1,
          unitPrice: client.amountPaid || 0,
          lineTotal: client.amountPaid || 0,
        },
      ],
      discountRate: 0,
      taxRate: 0,
      discountAmount: 0,
      taxAmount: 0,
      subtotalConverted: client.amountPaid || 0,
      processingFeeRate: 0,
      processingFeeConverted: 0,
      totalPayable: client.amountPaid || 0,
      status: 'PAID',
      paidAt: client.completedAt || client.createdAt,
      invoiceDate: client.createdAt,
      dueDate: client.createdAt,
      paymentGateway: 'ONLINE',
      notes: 'Official Tax Invoice / Payment Receipt',
    };
  }

  if (!invoice) {
    return new NextResponse('Paid invoice not found for this account', { status: 404 });
  }

  // If client is already completed, ensure status displays PAID on receipt
  if (client.status === 'COMPLETED' && invoice.status !== 'PAID') {
    invoice = { ...invoice, status: 'PAID', paidAt: invoice.paidAt || client.completedAt || client.createdAt };
  }

  try {
    const pdfBuffer = await generatePaidInvoicePdfBuffer(invoice as unknown as InvoiceData);
    const filename = `Invoice-${invoice.invoiceNumber}-PAID.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Portal Invoice PDF] Error generating PDF:', error);
    return new NextResponse('Error generating invoice PDF', { status: 500 });
  }
}
