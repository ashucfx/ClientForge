import { prisma } from '@/lib/db';

/**
 * Generates a sequential invoice number: RN-YYMM-0001
 * Uses the database to find the maximum existing sequence for the current month.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `RN-${year}${month}-`;

  // Use a transaction if we needed strict lock, but findFirst is sufficient 
  // for typical SaaS invoice volume.
  const latest = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: { invoiceNumber: true },
  });

  let nextSequence = 1;
  if (latest?.invoiceNumber) {
    const parts = latest.invoiceNumber.split('-');
    if (parts.length === 3) {
      const seqStr = parts[2];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum)) {
        nextSequence = seqNum + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}
