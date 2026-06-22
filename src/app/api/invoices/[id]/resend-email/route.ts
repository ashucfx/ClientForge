// src/app/api/invoices/[id]/resend-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/email';
import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }
  if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await sendInvoiceEmail(invoice as any);
    await prisma.invoice.update({
      where: { id: params.id },
      data: {
        emailSentAt: new Date(),
        emailResendCount: { increment: 1 },
      },
    });
    await prisma.sysEmailLog.create({
      data: {
        to: invoice.clientEmail,
        subject: `Invoice ${invoice.invoiceNumber} (resend)`,
        trigger: 'INVOICE_RESENT',
        channel: 'resend',
        status: 'sent',
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.totalPayable, currency: invoice.currency },
      },
    }).catch(() => {});
  } catch (err) {
    console.error('Resend email failed:', err);
    await prisma.sysEmailLog.create({
      data: {
        to: invoice.clientEmail,
        subject: `Invoice ${invoice.invoiceNumber} (resend)`,
        trigger: 'INVOICE_RESENT',
        channel: 'resend',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      },
    }).catch(() => {});
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
