import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { createProposal } from '@/lib/sales/proposalService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const proposal = await createProposal({
      inquiryId: params.id,
      title: body.title,
      scopeSummary: body.scopeSummary,
      deliverables: body.deliverables ?? [],
      lineItems: body.lineItems ?? [],
      currency: body.currency,
      currencySymbol: body.currencySymbol ?? '$',
      subtotal: body.subtotal,
      discount: body.discount ?? 0,
      tax: body.tax ?? 0,
      total: body.total,
      validUntil: new Date(body.validUntil),
      adminId: session.adminId,
    });

    return NextResponse.json({ success: true, data: proposal });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
