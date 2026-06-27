// Admin: list portal-generated upgrade invoices for a specific client
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: params.id },
    select: { email: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const invoices = await db.invoice.findMany({
    where: {
      clientEmail: client.email,
      notes: { contains: 'Portal automated upgrade.' },
    },
    select: {
      id: true,
      invoiceNumber: true,
      notes: true,
      totalPayable: true,
      currency: true,
      currencySymbol: true,
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

  return NextResponse.json({ invoices });
}
