import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendBankTransferRejectedEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const request = await db.bankTransferRequest.findUnique({
      where: { id: params.id }
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: request.invoiceId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Associated invoice not found' }, { status: 404 });
    }

    if (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes(invoice.brandId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedReq = await db.bankTransferRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' }
    });

    sendBankTransferRejectedEmail(updatedReq).catch(err => console.error(err));

    return NextResponse.json({ ok: true, request: updatedReq });
  } catch (err: any) {
    console.error('Reject error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
