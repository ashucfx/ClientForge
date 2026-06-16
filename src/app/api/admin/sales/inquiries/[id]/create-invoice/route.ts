import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { createInvoiceFromProposal } from '@/lib/sales/proposalService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.proposalId) {
      return NextResponse.json({ error: 'proposalId required' }, { status: 400 });
    }

    const result = await createInvoiceFromProposal(body.proposalId, session.adminId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice creation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
