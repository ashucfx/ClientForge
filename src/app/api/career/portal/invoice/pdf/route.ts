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
    select: { id: true, email: true, name: true, invoiceId: true },
  });
  if (!client) return new NextResponse('Client not found', { status: 404 });

  let invoice = null;
  if (client.invoiceId) {
    invoice = await db.invoice.findUnique({ where: { id: client.invoiceId } });
  }

  if (!invoice) {
    invoice = await db.invoice.findFirst({
      where: {
        clientEmail: { equals: client.email, mode: 'insensitive' },
        status: 'PAID',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!invoice) {
    return new NextResponse('Paid invoice not found for this account', { status: 404 });
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
