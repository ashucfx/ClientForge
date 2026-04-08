// src/app/api/invoices/[id]/resend-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/email';
import { isAdminRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}
