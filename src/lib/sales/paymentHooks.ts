import { prisma as db } from '@/lib/db';
import { markInquiryConverted } from './inquiryService';

/** Called after invoice is marked PAID — updates SalesInquiry, CheckoutSession, and FlywheelProfile.totalRevenue */
export async function handleSalesFunnelPayment(invoiceId: string, clientId?: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      checkoutSession: { select: { contactId: true } },
      salesInquiry:    { select: { contactId: true } },
    },
  });
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

  // Sync FlywheelProfile.totalRevenue — recalculate from source of truth
  const contactId = invoice.checkoutSession?.contactId ?? invoice.salesInquiry?.contactId;
  if (contactId) {
    await syncContactRevenue(contactId);
  }
}

/** Recalculate and persist a contact's total paid revenue into FlywheelProfile.totalRevenue */
export async function syncContactRevenue(contactId: string) {
  try {
    // FIX: Use subtotalConverted / exchangeRate to get the net revenue in INR.
    // - subtotalConverted excludes Razorpay fees and taxes (legitimate transactional amount).
    // - Dividing by exchangeRate converts the local currency amount back to INR correctly.
    //   (e.g. RM 1628 in MYR, exchangeRate = 0.056 INR/MYR → revenue = 1628 / 0.056 ≈ ₹29,000, not 91)
    // - Previously the query used totalPayable * exchangeRate which is backwards for INR-base rates.
    const result = await db.$queryRaw<[{ total: string }]>`
      SELECT COALESCE(SUM(i."subtotalConverted" / NULLIF(i."exchangeRate", 0)), 0) AS total
      FROM "Invoice" i
      LEFT JOIN "CheckoutSession" cs ON i."checkoutSessionId" = cs.id
      LEFT JOIN "SalesInquiry" si    ON i."salesInquiryId"    = si.id
      WHERE i."status" = 'PAID'
        AND (cs."contactId" = ${contactId} OR si."contactId" = ${contactId})
    `;
    const totalRevenue = Number(result[0]?.total || 0);

    await db.flywheelProfile.updateMany({
      where: { contactId },
      data:  { totalRevenue },
    });
  } catch (err) {
    console.error('[syncContactRevenue] Failed for contact', contactId, err);
  }
}
