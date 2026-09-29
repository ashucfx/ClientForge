// src/app/api/invoices/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { generatePaidInvoicePdfBuffer } from '@/lib/pdf/generateInvoicePdf';
import type { InvoiceData } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;
    if (!invoiceId) {
      return new NextResponse('Invoice ID required', { status: 400 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Verify Authorization: Admin OR Authenticated Client for this invoice
    const admin = await getAdminSession();
    let isAuthorized = Boolean(admin);

    if (!isAuthorized) {
      const portalToken = cookies().get(PORTAL_COOKIE)?.value;
      if (portalToken) {
        const payload = await verifyPortalToken(portalToken);
        if (payload?.clientId) {
          const client = await db.careerClient.findUnique({
            where: { id: payload.clientId },
            select: { id: true, email: true, invoiceId: true },
          });
          if (
            client &&
            (client.invoiceId === invoice.id ||
              client.email.toLowerCase() === invoice.clientEmail.toLowerCase())
          ) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Unauthorized access to invoice PDF', { status: 401 });
    }

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
    console.error('[Invoice PDF] Error generating PDF:', error);
    return new NextResponse('Error generating invoice PDF', { status: 500 });
  }
}
