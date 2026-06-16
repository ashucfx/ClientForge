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

    if (proposal.status === "ACCEPTED") {
      // If already accepted, return existing session or invoice if it exists
      const existingSession = await prisma.checkoutSession.findFirst({
        where: { proposalId: proposal.id },
        orderBy: { createdAt: "desc" },
      });
      if (existingSession) {
        return NextResponse.json({ sessionId: existingSession.id, checkoutUrl: `/checkout/proposal/${existingSession.id}` });
      }
    }

    // Mark as accepted
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

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
