import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

// Resend proposal email for SENT / VIEWED proposals (does not change status)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const proposal = await db.proposal.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, publicToken: true, sentAt: true },
    });

    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    if (!['SENT', 'VIEWED', 'DRAFT'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Cannot resend a proposal with status ${proposal.status}` },
        { status: 400 }
      );
    }

    // Update sentAt and ensure status is SENT
    await db.proposal.update({
      where: { id: params.id },
      data: {
        sentAt: new Date(),
        status: proposal.status === 'DRAFT' ? 'SENT' : proposal.status,
      },
    });

    const { sendProposalEmail } = await import('@/lib/sales/email');
    await sendProposalEmail(params.id);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';
    return NextResponse.json({
      success: true,
      publicUrl: `${baseUrl}/proposal/${proposal.publicToken}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
