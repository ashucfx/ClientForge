import { prisma as db } from '@/lib/db';
import { markInquiryConverted } from './inquiryService';

/** Called after invoice is marked PAID — updates SalesInquiry + CheckoutSession without touching legacy rows */
export async function handleSalesFunnelPayment(invoiceId: string, clientId?: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;

  if (invoice.salesInquiryId && invoice.sourceChannel === 'INQUIRE') {
    await markInquiryConverted(invoice.salesInquiryId, invoiceId, clientId);
  }

  if (invoice.checkoutSessionId && invoice.sourceChannel === 'APPLY') {
    await db.checkoutSession.update({
      where: { id: invoice.checkoutSessionId },
      data: { status: 'PAID' },
    });
  }
}
