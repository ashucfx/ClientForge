import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { FEE_RATES, round2 } from '@/lib/pricing';
import { PRICING } from '@/lib/pricing-v2';
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import type { CareerServiceSlug } from '@/lib/career/types';
import { ClientType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const targetUpgrade = searchParams.get('target');
  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS') {
    return NextResponse.json({ error: 'Invalid upgrade target' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    include: {
      services: { select: { service: { select: { slug: true } } } },
      invoiceLinks: {
        include: { invoice: { select: { clientType: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const existingServices = client.services.map(s => s.service.slug as CareerServiceSlug);
  const hasFull = existingServices.includes('FULL_PACKAGE');
  const hasPortfolio = existingServices.includes('PORTFOLIO');
  const hasResume = existingServices.includes('RESUME');
  const hasLinkedIn = existingServices.includes('LINKEDIN');
  const hasCoverLetter = existingServices.includes('COVER_LETTER');

  if (targetUpgrade === 'FULL_PACKAGE' && hasFull) {
    return NextResponse.json({ error: 'Already have full package' }, { status: 400 });
  }
  if (targetUpgrade === 'PREMIUM_PLUS' && hasPortfolio && hasFull) {
    return NextResponse.json({ error: 'Already have premium plus' }, { status: 400 });
  }

  const clientType = (client.invoiceLinks[0]?.invoice?.clientType as ClientType) || 'MID_CAREER';
  const baseInr = PRICING.basePrices.INR;
  if (!baseInr.RESUME[clientType] && clientType !== 'AGENCY_CLIENT') {
    return NextResponse.json({ error: 'Pricing not configured' }, { status: 400 });
  }

  // FULL_PACKAGE slug covers resume + linkedin + coverLetter
  const effectivelyHasResume      = hasResume      || hasFull;
  const effectivelyHasLinkedIn    = hasLinkedIn    || hasFull;
  const effectivelyHasCoverLetter = hasCoverLetter || hasFull;

  let targetPrice = 0;
  let currentlyPaid = 0;
  const whatYouGet: string[] = [];      // new items being added
  const currentPlan: string[] = [];     // items already in the client's plan

  // Build current plan labels for display
  if (hasFull) {
    currentPlan.push('Career Booster Package (Resume, LinkedIn, Cover Letter)');
  } else {
    if (hasResume)      currentPlan.push('Professional Resume Writing');
    if (hasLinkedIn)    currentPlan.push('LinkedIn Profile Optimisation');
    if (hasCoverLetter) currentPlan.push('Cover Letter Writing');
  }
  if (hasPortfolio) currentPlan.push('Portfolio Website Development');

  if (targetUpgrade === 'FULL_PACKAGE') {
    targetPrice = baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType];
    if (!effectivelyHasResume)      whatYouGet.push('Professional Resume Writing');
    if (!effectivelyHasLinkedIn)    whatYouGet.push('LinkedIn Profile Optimisation');
    if (!effectivelyHasCoverLetter) whatYouGet.push('Cover Letter Writing');
  } else {
    targetPrice = baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType] + baseInr.PORTFOLIO[clientType];
    if (!effectivelyHasResume)      whatYouGet.push('Professional Resume Writing');
    if (!effectivelyHasLinkedIn)    whatYouGet.push('LinkedIn Profile Optimisation');
    if (!effectivelyHasCoverLetter) whatYouGet.push('Cover Letter Writing');
    if (!hasPortfolio)              whatYouGet.push('Portfolio Website Development');
  }

  if (hasFull) {
    currentlyPaid += baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType];
  } else {
    if (hasResume)      currentlyPaid += baseInr.RESUME[clientType];
    if (hasLinkedIn)    currentlyPaid += baseInr.LINKEDIN[clientType];
    if (hasCoverLetter) currentlyPaid += baseInr.COVER_LETTER[clientType];
  }
  if (hasPortfolio) currentlyPaid += baseInr.PORTFOLIO[clientType];

  const differenceInr = targetPrice - currentlyPaid;
  if (differenceInr <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  // 18% GST on the differential (service delivery subject to GST, same as checkout)
  const taxRate = 0.18;
  const taxAmount = round2(differenceInr * taxRate);
  const costWithTax = differenceInr + taxAmount;
  // Razorpay domestic gross-up: client pays enough so that after Razorpay's 2.36% cut, we net costWithTax
  const totalPayable = Math.ceil(costWithTax / (1 - FEE_RATES.INR));
  const processingFee = totalPayable - costWithTax;
  const processingFeeRate = FEE_RATES.INR;

  // Check for an existing unexpired payment link the client can reuse
  const upgradeNoteMarker = `Portal automated upgrade. Target: ${targetUpgrade}`;
  const existingInvoice = await db.invoice.findFirst({
    where: {
      clientEmail: client.email,
      notes: { contains: upgradeNoteMarker },
      razorpayLinkUrl: { not: null },
      dueDate: { gt: new Date() },
    },
    select: { razorpayLinkUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    ok: true,
    targetService: targetUpgrade,
    upgradeLabel: targetUpgrade === 'FULL_PACKAGE' ? 'Career Booster Package' : 'Premium Plus Package',
    currentPlan,
    whatYouGet,
    differenceInr,
    taxRate,
    taxAmount,
    processingFee,
    processingFeeRate,
    totalPayable,
    currency: 'INR',
    existingPaymentUrl: existingInvoice?.razorpayLinkUrl ?? null,
  });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetUpgrade = body?.targetService; // 'FULL_PACKAGE' or 'PREMIUM_PLUS'
  
  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS') {
    return NextResponse.json({ error: 'Invalid upgrade target' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    include: {
      services: { select: { service: { select: { slug: true } } } },
      invoiceLinks: {
        include: { invoice: { select: { clientType: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const existingServices = client.services.map(s => s.service.slug as CareerServiceSlug);
  const hasResume = existingServices.includes('RESUME');
  const hasLinkedIn = existingServices.includes('LINKEDIN');
  const hasCoverLetter = existingServices.includes('COVER_LETTER');
  const hasFull = existingServices.includes('FULL_PACKAGE');
  const hasPortfolio = existingServices.includes('PORTFOLIO');

  // Verify they actually need an upgrade
  if (targetUpgrade === 'FULL_PACKAGE' && hasFull) {
    return NextResponse.json({ error: 'Already have full package' }, { status: 400 });
  }
  if (targetUpgrade === 'PREMIUM_PLUS' && hasPortfolio && hasFull) {
    return NextResponse.json({ error: 'Already have premium plus' }, { status: 400 });
  }

  // Calculate difference based on their original tier using current pricing
  const clientType = (client.invoiceLinks[0]?.invoice?.clientType as ClientType) || 'MID_CAREER';
  const baseInr = PRICING.basePrices.INR;

  let targetPrice = 0;
  let currentlyPaid = 0;

  if (targetUpgrade === 'FULL_PACKAGE') {
    targetPrice = baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType];
  } else {
    targetPrice = baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType] + baseInr.PORTFOLIO[clientType];
  }

  if (hasFull) {
    currentlyPaid += baseInr.RESUME[clientType] + baseInr.LINKEDIN[clientType] + baseInr.COVER_LETTER[clientType];
  } else {
    if (hasResume)      currentlyPaid += baseInr.RESUME[clientType];
    if (hasLinkedIn)    currentlyPaid += baseInr.LINKEDIN[clientType];
    if (hasCoverLetter) currentlyPaid += baseInr.COVER_LETTER[clientType];
  }
  if (hasPortfolio) currentlyPaid += baseInr.PORTFOLIO[clientType];

  const differenceInr = targetPrice - currentlyPaid;
  if (differenceInr <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  // Reuse an existing unexpired upgrade invoice instead of creating duplicates
  const upgradeNoteMarker = `Portal automated upgrade. Target: ${targetUpgrade}`;
  const existingInvoice = await db.invoice.findFirst({
    where: {
      clientEmail: client.email,
      notes: { contains: upgradeNoteMarker },
      razorpayLinkUrl: { not: null },
      dueDate: { gt: new Date() },
    },
    select: { razorpayLinkUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existingInvoice?.razorpayLinkUrl) {
    const _tax = round2(differenceInr * 0.18);
    const _total = Math.ceil((differenceInr + _tax) / (1 - FEE_RATES.INR));
    return NextResponse.json({
      ok: true,
      paymentUrl: existingInvoice.razorpayLinkUrl,
      difference: differenceInr,
      totalPayable: _total,
      reused: true,
    });
  }

  // 18% GST + Razorpay gateway gross-up (matching checkout pricing logic)
  const subtotalConverted = differenceInr;
  const taxRate = 0.18;
  const taxAmount = round2(differenceInr * taxRate);
  const costWithTax = differenceInr + taxAmount;
  const processingFeeRate = FEE_RATES.INR;
  const totalPayable = Math.ceil(costWithTax / (1 - processingFeeRate));
  const processingFeeConverted = totalPayable - costWithTax;

  const invoiceDate = new Date();
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h window — Razorpay expire_by uses this

  let invoice;
  let createError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const invoiceNumber = await getNextInvoiceNumber();
      invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          brandId: 'catalyst',
          clientName: client.name,
          clientEmail: client.email,
          clientPhone: client.phone || '+910000000000',
          clientType,
          country: 'IN',
          currency: 'INR',
          currencySymbol: '₹',
          exchangeRate: 1,
          lineItems: [
            {
              id: 'upgrade_1',
              description: `Upgrade to ${targetUpgrade === 'FULL_PACKAGE' ? 'Complete Career Booster (Resume, LinkedIn, Cover Letter)' : 'Premium Plus Package (Career Booster + Portfolio)'}`,
              qty: 1,
              unitPrice: differenceInr,
              lineTotal: differenceInr
            }
          ],
          discountRate: 0,
          taxRate,
          discountAmount: 0,
          taxAmount,
          subtotalConverted,
          processingFeeRate,
          processingFeeConverted,
          totalPayable,
          notes: `Portal automated upgrade. Target: ${targetUpgrade}`,
          invoiceDate,
          dueDate,
          installmentPlan: false,
          installmentCount: 1,
          paymentGateway: 'RAZORPAY',
        }
      });
      break; // Success
    } catch (err: any) {
      if (err.code === 'P2002') {
        createError = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 100 * attempt));
          continue;
        }
      }
      throw err;
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Failed to generate invoice sequence. Please try again.' }, { status: 500 });
  }

  try {
    const rzp = await createRazorpayPaymentLink(invoice as any);
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        razorpayLinkId: rzp.id,
        razorpayLinkUrl: rzp.short_url,
      }
    });

    return NextResponse.json({ 
      ok: true, 
      paymentUrl: rzp.short_url,
      difference: differenceInr,
      totalPayable
    });
  } catch (err: any) {
    console.error('Upgrade Razorpay Error:', err?.message ?? err);
    await db.invoice.delete({ where: { id: invoice.id }});
    return NextResponse.json({ error: 'Payment link creation failed' }, { status: 500 });
  }
}
