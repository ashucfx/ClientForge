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

    let invoice: any = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      const clientId = invoiceId.startsWith('client-') ? invoiceId.replace('client-', '') : invoiceId;
      const client = await db.careerClient.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          packageType: true,
          amountPaid: true,
          currency: true,
          status: true,
          createdAt: true,
          completedAt: true,
          contact: { select: { country: true } },
          services: { select: { service: { select: { name: true } } } },
        },
      });

      if (client) {
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
    }

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
