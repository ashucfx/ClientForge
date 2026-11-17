import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { PORTAL_COOKIE, verifyPortalToken } from '@/lib/career/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const invoiceFields = {
  id: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  currencySymbol: true,
  totalPayable: true,
  invoiceDate: true,
  dueDate: true,
  paidAt: true,
  brandId: true,
} as const;

type InvoiceSummary = {
  id: string | null;
  invoiceNumber: string;
  status: string;
  currency: string;
  currencySymbol: string;
  totalPayable: number;
  invoiceDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  isLegacyReceipt?: boolean;
};

export async function GET() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const session = await verifyPortalToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: session.clientId },
    select: {
      id: true,
      email: true,
      invoiceId: true,
      amountPaid: true,
      currency: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const [linkedRows, directInvoice, emailInvoices] = await Promise.all([
    db.invoiceClientLink.findMany({
      where: { clientId: client.id },
      select: { invoice: { select: invoiceFields } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    client.invoiceId
      ? db.invoice.findFirst({ where: { id: client.invoiceId, brandId: 'catalyst' }, select: invoiceFields })
      : Promise.resolve(null),
    db.invoice.findMany({
      where: { brandId: 'catalyst', clientEmail: { equals: client.email, mode: 'insensitive' } },
      select: invoiceFields,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
  ]);

  const uniqueInvoices = new Map<string, (typeof emailInvoices)[number]>();
  for (const invoice of [
    ...linkedRows.map(row => row.invoice),
    ...(directInvoice ? [directInvoice] : []),
    ...emailInvoices,
  ]) {
    if (invoice.brandId === 'catalyst') uniqueInvoices.set(invoice.id, invoice);
  }

  const invoices: InvoiceSummary[] = [...uniqueInvoices.values()]
    .sort((left, right) => right.invoiceDate.getTime() - left.invoiceDate.getTime())
    .map(({ brandId: _brandId, ...invoice }) => invoice);

  if (invoices.length === 0 && (client.amountPaid > 0 || client.status === 'COMPLETED')) {
    const invoiceDate = client.createdAt;
    invoices.push({
      id: null,
      invoiceNumber: `CAT-${invoiceDate.getFullYear()}-${client.id.slice(-6).toUpperCase()}`,
      status: 'PAID',
      currency: client.currency || 'INR',
      currencySymbol: client.currency === 'USD' ? '$' : '₹',
      totalPayable: client.amountPaid || 0,
      invoiceDate,
      dueDate: invoiceDate,
      paidAt: client.completedAt ?? invoiceDate,
      isLegacyReceipt: true,
    });
  }

  return NextResponse.json({ invoices });
}
