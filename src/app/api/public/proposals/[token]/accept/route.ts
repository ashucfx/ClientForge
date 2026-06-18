import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCheckoutSessionFromProposal } from "@/lib/sales/checkoutService";

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const { token } = params;

    const proposal = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: {
        inquiry: true,
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status === "EXPIRED" || proposal.validUntil < new Date()) {
      if (proposal.status !== "EXPIRED") {
        await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "EXPIRED" } });
      }
      return NextResponse.json({ error: "Proposal has expired" }, { status: 400 });
    }

    // Atomic transition: only succeeds if the proposal is still in a pre-accept state.
    // Prevents duplicate invoice creation when two concurrent requests race to accept.
    const { count } = await prisma.proposal.updateMany({
      where: { id: proposal.id, status: { in: ['SENT', 'VIEWED', 'DRAFT'] } },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    if (count === 0) {
      // Already accepted (by this request or a concurrent one) — return existing session
      const existingSession = await prisma.checkoutSession.findFirst({
        where: { proposalId: proposal.id },
        orderBy: { createdAt: "desc" },
      });
      if (existingSession) {
        return NextResponse.json({ sessionId: existingSession.id, checkoutUrl: `/checkout/proposal/${existingSession.id}` });
      }
      return NextResponse.json({ error: "Proposal already accepted" }, { status: 409 });
    }

    // Create checkout session and invoice
    const result = await createCheckoutSessionFromProposal(proposal.id);

    return NextResponse.json({
      success: true,
      sessionId: result.checkoutSessionId,
      checkoutUrl: `/checkout/proposal/${result.checkoutSessionId}`,
    });
  } catch (error: any) {
    console.error("Error accepting proposal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
