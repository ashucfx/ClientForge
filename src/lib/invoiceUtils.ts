import { prisma } from '@/lib/db';
import crypto from 'crypto';

/**
 * Generates a sequential invoice number with a random collision-guard suffix.
 * Format: {prefix}-YYMM-{seq}-{6 hex chars}
 * The 6-char hex suffix (~16M combinations) makes concurrent collision
 * statistically impossible without requiring a DB sequence or advisory lock.
 *
 * @param prefix  - 'RN' for admin-created invoices, 'INV' for self-service checkout
 */
export async function getNextInvoiceNumber(prefix: 'RN' | 'INV' = 'RN'): Promise<string> {
  const now = new Date();
  const year  = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${prefix}-${year}${month}-`;

  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: monthPrefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSequence = 1;
  if (latest?.invoiceNumber) {
    const parts = latest.invoiceNumber.split('-');
    const seqPart = parts[2];
    const seqNum  = seqPart ? parseInt(seqPart, 10) : NaN;
    if (!isNaN(seqNum)) nextSequence = seqNum + 1;
  }

  const seq    = String(nextSequence).padStart(4, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${monthPrefix}${seq}-${suffix}`;
}
