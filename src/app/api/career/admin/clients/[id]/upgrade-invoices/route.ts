// Admin: list all invoices (initial, upgrades, revisions, legacy) for a specific client
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      invoiceId: true,
      amountPaid: true,
      currency: true,
      packageType: true,
      status: true,
      createdAt: true,
      completedAt: true,
      services: { select: { service: { select: { name: true } } } },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // 1. Collect all possible invoice IDs associated with this client
  const targetInvoiceIds = new Set<string>();
  if (client.invoiceId) targetInvoiceIds.add(client.invoiceId);

  const links = await db.invoiceClientLink.findMany({
    where: { clientId: client.id },
    select: { invoiceId: true },
  });
  links.forEach(l => targetInvoiceIds.add(l.invoiceId));

  const revisions = await db.careerRevision.findMany({
    where: { clientId: client.id, invoiceId: { not: null } },
    select: { invoiceId: true },
  });
  revisions.forEach(r => { if (r.invoiceId) targetInvoiceIds.add(r.invoiceId); });

  // 2. Fetch all matching invoices (by ID or by client email)
  const invoices = await db.invoice.findMany({
    where: {
      OR: [
        { id: { in: Array.from(targetInvoiceIds) } },
        { clientEmail: { equals: client.email, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      notes: true,
      totalPayable: true,
      currency: true,
      currencySymbol: true,
      clientType: true,
      status: true,
      razorpayLinkUrl: true,
      razorpayLinkId: true,
      razorpayPaymentId: true,
      invoiceDate: true,
      dueDate: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 3. Fallback for historical/legacy clients without a separate Invoice record in DB
  if (invoices.length === 0 && (client.amountPaid > 0 || client.status === 'COMPLETED')) {
    invoices.push({
      id: `client-${client.id}`,
      invoiceNumber: `CAT-${new Date(client.createdAt).getFullYear()}-${client.id.slice(-6).toUpperCase()}`,
      notes: `Historical Enrollment (${client.services?.map(s => s.service.name).join(', ') || client.packageType || 'Service Package'})`,
      totalPayable: client.amountPaid || 0,
      currency: client.currency || 'INR',
      currencySymbol: client.currency === 'USD' ? '$' : '₹',
      clientType: (client.packageType as any) || 'MID_CAREER',
      status: 'PAID',
      razorpayLinkUrl: null,
      razorpayLinkId: null,
      razorpayPaymentId: null,
      invoiceDate: client.createdAt,
      dueDate: client.createdAt,
      paidAt: client.completedAt || client.createdAt,
    });
  }

  return NextResponse.json({ invoices });
}
