import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getProposalByToken, acceptProposal, declineProposal } from '@/lib/sales/proposalService';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';

const ProposalActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), email: z.string().email() }),
  z.object({ action: z.literal('decline'), reason: z.string().max(1000).optional() }),
]);

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const proposal = await getProposalByToken(params.token);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        scopeSummary: proposal.scopeSummary,
        deliverables: proposal.deliverables,
        lineItems: proposal.lineItems,
        currency: proposal.currency,
        currencySymbol: proposal.currencySymbol,
        subtotal: proposal.subtotal,
        discount: proposal.discount,
        tax: proposal.tax,
        total: proposal.total,
        validUntil: proposal.validUntil,
        status: proposal.status,
        version: proposal.version,
        clientName: proposal.inquiry.name,
        clientEmail: proposal.inquiry.email,
      },
    });
  } catch (error) {
    console.error('Get proposal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json();
    const parsed = ProposalActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'accept') {
      const limited = await enforcePublicRateLimit(req, {
        action: `proposal_accept:${params.token}`,
        email: parsed.data.email,
        ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
        emailLimit: { limit: 5, windowMs: 60 * 60 * 1000 },
      });
      if (limited) return limited;

      const proposal = await acceptProposal(params.token, parsed.data.email);

      // System automatically generates Custom Checkout Session, Unique Checkout URL, Unique Invoice
      const { createCheckoutSessionFromProposal } = await import('@/lib/sales/checkoutService');
      const checkoutResult = await createCheckoutSessionFromProposal(proposal.id);

      return NextResponse.json({ 
        success: true, 
        status: proposal.status,
        checkoutUrl: `/checkout/session/${checkoutResult.checkoutSessionId}`
      });
    }

    if (parsed.data.action === 'decline') {
      const limited = await enforcePublicRateLimit(req, {
        action: `proposal_decline:${params.token}`,
        ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
      });
      if (limited) return limited;

      const proposal = await declineProposal(params.token, parsed.data.reason);
      return NextResponse.json({ success: true, status: proposal.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
