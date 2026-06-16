import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { sendProposal } from '@/lib/sales/proposalService';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const proposal = await sendProposal(params.id, session.adminId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';
    return NextResponse.json({
      success: true,
      data: proposal,
      publicUrl: `${baseUrl}/proposal/${proposal.publicToken}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
