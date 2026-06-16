import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inquiryId = searchParams.get("inquiryId");

    const whereClause = inquiryId ? { inquiryId } : {};

    const proposals = await prisma.proposal.findMany({
      where: whereClause,
      include: {
        inquiry: {
          select: { name: true, email: true, displayId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(proposals);
  } catch (error: any) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      inquiryId,
      title,
      scopeSummary,
      deliverables,
      lineItems,
      revisionLimits,
      deliveryTimeline,
      currency,
      currencySymbol,
      subtotal,
      discount,
      tax,
      total,
      validUntil,
    } = body;

    const proposal = await prisma.proposal.create({
      data: {
        inquiryId,
        title,
        scopeSummary,
        deliverables: deliverables || [],
        lineItems: lineItems || [],
        revisionLimits: revisionLimits || null,
        deliveryTimeline: deliveryTimeline || null,
        currency,
        currencySymbol: currencySymbol || "$",
        subtotal,
        discount: discount || 0,
        tax: tax || 0,
        total,
        validUntil: new Date(validUntil),
        status: "DRAFT",
      },
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (error: any) {
    console.error("Error creating proposal:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
