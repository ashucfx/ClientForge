import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { FEE_RATES, round2 } from '@/lib/pricing';
import { PRICING } from '@/lib/pricing-v2';
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { createPaypalInvoice } from '@/lib/paypal';
import type { CareerServiceSlug } from '@/lib/career/types';
import { ClientType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── PayPal fee gross-up: (diff + $0.30 fixed) / (1 - 4.4%) ──────────────────
function calcPaypalTotal(diffUsd: number): { totalPayable: number; processingFee: number } {
  const PAYPAL_FIXED = 0.30;
  const PAYPAL_PCT   = 0.044;
  const raw = (diffUsd + PAYPAL_FIXED) / (1 - PAYPAL_PCT);
  const totalPayable = Math.ceil(raw * 100) / 100; // round up to 2dp
  return { totalPayable, processingFee: round2(totalPayable - diffUsd) };
}

// ─── Razorpay INR gross-up: diff_inr × 1.18 GST / 0.9764 ────────────────────
function calcRazorpayTotal(diffInr: number): {
  totalPayable: number; taxAmount: number; taxRate: number; processingFee: number;
} {
  const taxRate    = 0.18;
  const taxAmount  = round2(diffInr * taxRate);
  const totalPayable = Math.ceil((diffInr + taxAmount) / (1 - FEE_RATES.INR));
  return { totalPayable, taxAmount, taxRate, processingFee: totalPayable - diffInr - taxAmount };
}

// ─── Detect client's gateway from original purchase ──────────────────────────
function detectGateway(currency: string | null, country: string | null) {
  const cur = (currency ?? 'INR').toUpperCase();
  const ctry = (country  ?? 'IN' ).toUpperCase();
  const isIndia = ctry === 'IN' || cur === 'INR';
  return {
    isIndia,
    gateway:        isIndia ? 'RAZORPAY' : 'PAYPAL',
    currency:       isIndia ? 'INR'      : 'USD',
    currencySymbol: isIndia ? '₹'        : '$',
  } as const;
}

// ─── GET — price preview ─────────────────────────────────────────────────────
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
        include: { invoice: { select: { clientType: true, currency: true, country: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const existingServices = client.services.map(s => s.service.slug as CareerServiceSlug);
  const hasFull      = existingServices.includes('FULL_PACKAGE');
  const hasPortfolio = existingServices.includes('PORTFOLIO');
  const hasResume    = existingServices.includes('RESUME');
  const hasLinkedIn  = existingServices.includes('LINKEDIN');
  const hasCoverLetter = existingServices.includes('COVER_LETTER');

  if (targetUpgrade === 'FULL_PACKAGE' && hasFull) {
    return NextResponse.json({ error: 'Already have full package' }, { status: 400 });
  }
  if (targetUpgrade === 'PREMIUM_PLUS' && hasPortfolio && hasFull) {
    return NextResponse.json({ error: 'Already have premium plus' }, { status: 400 });
  }

  const invoiceData  = client.invoiceLinks[0]?.invoice;
  const clientType   = (invoiceData?.clientType as ClientType) || 'MID_CAREER';
  const { isIndia, gateway, currency, currencySymbol } = detectGateway(
    invoiceData?.currency ?? null,
    invoiceData?.country  ?? null,
  );

  const basePrices = isIndia ? PRICING.basePrices.INR : PRICING.basePrices.USD;

  // FULL_PACKAGE slug covers resume + linkedin + coverLetter
  const effectivelyHasResume      = hasResume      || hasFull;
  const effectivelyHasLinkedIn    = hasLinkedIn    || hasFull;
  const effectivelyHasCoverLetter = hasCoverLetter || hasFull;

  let targetPrice  = 0;
  let currentlyPaid = 0;
  const whatYouGet: string[] = [];
  const currentPlan: string[] = [];

  if (hasFull) {
    currentPlan.push('Career Booster Package (Resume, LinkedIn, Cover Letter)');
  } else {
    if (hasResume)      currentPlan.push('Professional Resume Writing');
    if (hasLinkedIn)    currentPlan.push('LinkedIn Profile Optimisation');
    if (hasCoverLetter) currentPlan.push('Cover Letter Writing');
  }
  if (hasPortfolio) currentPlan.push('Portfolio Website Development');

  if (targetUpgrade === 'FULL_PACKAGE') {
    targetPrice = basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType];
    if (!effectivelyHasResume)      whatYouGet.push('Professional Resume Writing');
    if (!effectivelyHasLinkedIn)    whatYouGet.push('LinkedIn Profile Optimisation');
    if (!effectivelyHasCoverLetter) whatYouGet.push('Cover Letter Writing');
  } else {
    targetPrice = basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType] + basePrices.PORTFOLIO[clientType];
    if (!effectivelyHasResume)      whatYouGet.push('Professional Resume Writing');
    if (!effectivelyHasLinkedIn)    whatYouGet.push('LinkedIn Profile Optimisation');
    if (!effectivelyHasCoverLetter) whatYouGet.push('Cover Letter Writing');
    if (!hasPortfolio)              whatYouGet.push('Portfolio Website Development');
  }

  if (hasFull) {
    currentlyPaid += basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType];
  } else {
    if (hasResume)      currentlyPaid += basePrices.RESUME[clientType];
    if (hasLinkedIn)    currentlyPaid += basePrices.LINKEDIN[clientType];
    if (hasCoverLetter) currentlyPaid += basePrices.COVER_LETTER[clientType];
  }
  if (hasPortfolio) currentlyPaid += basePrices.PORTFOLIO[clientType];

  const differenceBase = targetPrice - currentlyPaid;
  if (differenceBase <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  let totalPayable: number;
  let taxRate      = 0;
  let taxAmount    = 0;
  let processingFee: number;
  let processingFeeRate: number;

  if (isIndia) {
    const r = calcRazorpayTotal(differenceBase);
    totalPayable    = r.totalPayable;
    taxRate         = r.taxRate;
    taxAmount       = r.taxAmount;
    processingFee   = r.processingFee;
    processingFeeRate = FEE_RATES.INR;
  } else {
    const r = calcPaypalTotal(differenceBase);
    totalPayable    = r.totalPayable;
    processingFee   = r.processingFee;
    processingFeeRate = 0.044; // PayPal 4.4% (approx, shown in modal)
  }

  // Check for reusable existing payment link
  const upgradeNoteMarker = `Portal automated upgrade. Target: ${targetUpgrade}`;
  const existingInvoice = await db.invoice.findFirst({
    where: {
      clientEmail: client.email,
      notes:    { contains: upgradeNoteMarker },
      dueDate:  { gt: new Date() },
      ...(isIndia
        ? { razorpayLinkUrl: { not: null } }
        : { paypalPaymentUrl: { not: null } }),
    },
    select: { razorpayLinkUrl: true, paypalPaymentUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  const existingPaymentUrl = isIndia
    ? (existingInvoice?.razorpayLinkUrl ?? null)
    : (existingInvoice?.paypalPaymentUrl ?? null);

  return NextResponse.json({
    ok: true,
    targetService:  targetUpgrade,
    upgradeLabel:   targetUpgrade === 'FULL_PACKAGE' ? 'Career Booster Package' : 'Premium Plus Package',
    currentPlan,
    whatYouGet,
    differenceBase,
    taxRate,
    taxAmount,
    processingFee,
    processingFeeRate,
    totalPayable,
    gateway,
    currency,
    currencySymbol,
    existingPaymentUrl,
  });
}

// ─── POST — create invoice + payment link ────────────────────────────────────
export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetUpgrade = body?.targetService as string | undefined;

  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS') {
    return NextResponse.json({ error: 'Invalid upgrade target' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    include: {
      services: { select: { service: { select: { slug: true } } } },
      invoiceLinks: {
        include: { invoice: { select: { clientType: true, currency: true, country: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const existingServices = client.services.map(s => s.service.slug as CareerServiceSlug);
  const hasResume      = existingServices.includes('RESUME');
  const hasLinkedIn    = existingServices.includes('LINKEDIN');
  const hasCoverLetter = existingServices.includes('COVER_LETTER');
  const hasFull        = existingServices.includes('FULL_PACKAGE');
  const hasPortfolio   = existingServices.includes('PORTFOLIO');

  if (targetUpgrade === 'FULL_PACKAGE' && hasFull) {
    return NextResponse.json({ error: 'Already have full package' }, { status: 400 });
  }
  if (targetUpgrade === 'PREMIUM_PLUS' && hasPortfolio && hasFull) {
    return NextResponse.json({ error: 'Already have premium plus' }, { status: 400 });
  }

  const invoiceData = client.invoiceLinks[0]?.invoice;
  const clientType  = (invoiceData?.clientType as ClientType) || 'MID_CAREER';
  const { isIndia, gateway, currency, currencySymbol } = detectGateway(
    invoiceData?.currency ?? null,
    invoiceData?.country  ?? null,
  );

  const basePrices = isIndia ? PRICING.basePrices.INR : PRICING.basePrices.USD;

  let targetPrice  = 0;
  let currentlyPaid = 0;

  if (targetUpgrade === 'FULL_PACKAGE') {
    targetPrice = basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType];
  } else {
    targetPrice = basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType] + basePrices.PORTFOLIO[clientType];
  }

  if (hasFull) {
    currentlyPaid += basePrices.RESUME[clientType] + basePrices.LINKEDIN[clientType] + basePrices.COVER_LETTER[clientType];
  } else {
    if (hasResume)      currentlyPaid += basePrices.RESUME[clientType];
    if (hasLinkedIn)    currentlyPaid += basePrices.LINKEDIN[clientType];
    if (hasCoverLetter) currentlyPaid += basePrices.COVER_LETTER[clientType];
  }
  if (hasPortfolio) currentlyPaid += basePrices.PORTFOLIO[clientType];

  const differenceBase = targetPrice - currentlyPaid;
  if (differenceBase <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  // Reuse existing unexpired invoice
  const upgradeNoteMarker = `Portal automated upgrade. Target: ${targetUpgrade}`;
  const existingInvoice = await db.invoice.findFirst({
    where: {
      clientEmail: client.email,
      notes:   { contains: upgradeNoteMarker },
      dueDate: { gt: new Date() },
      ...(isIndia
        ? { razorpayLinkUrl: { not: null } }
        : { paypalPaymentUrl: { not: null } }),
    },
    select: { razorpayLinkUrl: true, paypalPaymentUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existingInvoice) {
    const existingUrl = isIndia ? existingInvoice.razorpayLinkUrl : existingInvoice.paypalPaymentUrl;
    if (existingUrl) {
      let total: number;
      if (isIndia) {
        const _tax = round2(differenceBase * 0.18);
        total = Math.ceil((differenceBase + _tax) / (1 - FEE_RATES.INR));
      } else {
        total = calcPaypalTotal(differenceBase).totalPayable;
      }
      return NextResponse.json({ ok: true, paymentUrl: existingUrl, differenceBase, totalPayable: total, reused: true });
    }
  }

  // Compute final amounts
  let totalPayable: number;
  let taxRate            = 0;
  let taxAmount          = 0;
  let processingFeeRate: number;
  let processingFeeConverted: number;

  if (isIndia) {
    const r = calcRazorpayTotal(differenceBase);
    totalPayable         = r.totalPayable;
    taxRate              = r.taxRate;
    taxAmount            = r.taxAmount;
    processingFeeRate    = FEE_RATES.INR;
    processingFeeConverted = r.processingFee;
  } else {
    const r = calcPaypalTotal(differenceBase);
    totalPayable         = r.totalPayable;
    processingFeeRate    = 0.044;
    processingFeeConverted = r.processingFee;
  }

  const invoiceDate = new Date();
  const dueDate     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day window

  const upgradeDescription = targetUpgrade === 'FULL_PACKAGE'
    ? 'Upgrade to Complete Career Booster (Resume, LinkedIn, Cover Letter)'
    : 'Upgrade to Premium Plus Package (Career Booster + Portfolio)';

  // Build one line item per NEW service being added, so onboarding grants exactly
  // what was paid for. (A single combined "Career Booster + Portfolio" line was
  // matched as FULL_PACKAGE and silently dropped the portfolio.) Item prices sum
  // to differenceBase.
  const effectivelyHasResume      = hasResume      || hasFull;
  const effectivelyHasLinkedIn    = hasLinkedIn    || hasFull;
  const effectivelyHasCoverLetter = hasCoverLetter || hasFull;
  const upgradeItems: { description: string; unitPrice: number }[] = [];
  if (!effectivelyHasResume)      upgradeItems.push({ description: 'Professional Resume Writing',   unitPrice: basePrices.RESUME[clientType] });
  if (!effectivelyHasLinkedIn)    upgradeItems.push({ description: 'LinkedIn Profile Optimisation', unitPrice: basePrices.LINKEDIN[clientType] });
  if (!effectivelyHasCoverLetter) upgradeItems.push({ description: 'Cover Letter Writing',          unitPrice: basePrices.COVER_LETTER[clientType] });
  if (targetUpgrade === 'PREMIUM_PLUS' && !hasPortfolio) upgradeItems.push({ description: 'Portfolio Website Development', unitPrice: basePrices.PORTFOLIO[clientType] });
  if (upgradeItems.length === 0) upgradeItems.push({ description: upgradeDescription, unitPrice: differenceBase });

  // Create invoice with retry for invoice-number collision
  let invoice: Awaited<ReturnType<typeof db.invoice.create>> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const invoiceNumber = await getNextInvoiceNumber();
      invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          brandId:     'catalyst',
          clientName:  client.name,
          clientEmail: client.email,
          clientPhone: client.phone || '+910000000000',
          clientType,
          country:         isIndia ? 'IN' : (invoiceData?.country ?? 'US'),
          currency,
          currencySymbol,
          exchangeRate:    1,
          lineItems: upgradeItems.map((it, i) => ({
            id:          `upgrade_${i + 1}`,
            description: it.description,
            qty:         1,
            unitPrice:   it.unitPrice,
            lineTotal:   it.unitPrice,
          })),
          discountRate:          0,
          discountAmount:        0,
          taxRate,
          taxAmount,
          subtotalConverted:     differenceBase,
          processingFeeRate,
          processingFeeConverted,
          totalPayable,
          paymentGateway:        gateway,
          notes:                 `Portal automated upgrade. Target: ${targetUpgrade}`,
          invoiceDate,
          dueDate,
          installmentPlan:  false,
          installmentCount: 1,
          status:           'PENDING',
        }
      });
      break;
    } catch (err: any) {
      if (err.code === 'P2002' && attempt < 3) {
        await new Promise(r => setTimeout(r, 100 * attempt));
        continue;
      }
      throw err;
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Failed to generate invoice. Please try again.' }, { status: 500 });
  }

  // Create payment link
  try {
    if (isIndia) {
      // Razorpay domestic
      const rzp = await createRazorpayPaymentLink(invoice as any);
      await db.invoice.update({
        where: { id: invoice.id },
        data:  { razorpayLinkId: rzp.id, razorpayLinkUrl: rzp.short_url },
      });
      return NextResponse.json({ ok: true, paymentUrl: rzp.short_url, differenceBase, totalPayable });
    } else {
      // PayPal — preferred for international
      const ppRes = await createPaypalInvoice({
        id:            invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName:    client.name,
        clientEmail:   client.email,
        currency:      'USD',
        dueDate,
        notes:         `Upgrade to ${targetUpgrade === 'FULL_PACKAGE' ? 'Career Booster Package' : 'Premium Plus Package'} — Catalyst Career Services`,
        lineItems: upgradeItems.map(it => ({
          description: it.description,
          qty:         1,
          unitPrice:   it.unitPrice,
        })),
        taxAmount:          0,
        discountAmount:     0,
        processingFeeAmount: processingFeeConverted,
      });
      await db.invoice.update({
        where: { id: invoice.id },
        data:  { paypalInvoiceId: ppRes.id, paypalPaymentUrl: ppRes.paymentUrl },
      });
      return NextResponse.json({ ok: true, paymentUrl: ppRes.paymentUrl, differenceBase, totalPayable });
    }
  } catch (err: any) {
    console.error('[upgrade] Payment link creation failed:', err?.message ?? err);
    await db.invoice.delete({ where: { id: invoice.id } }).catch(() => null);
    return NextResponse.json({ error: 'Payment link creation failed. Please try again.' }, { status: 500 });
  }
}
