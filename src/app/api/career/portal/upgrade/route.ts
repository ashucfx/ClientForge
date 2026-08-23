import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { round2 } from '@/lib/pricing';
import { PRICING } from '@/lib/pricing-v2';
import { getCurrencyForCountry, getExchangeRate, countryNameFromIso } from '@/lib/currency';
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { createPaypalInvoice } from '@/lib/paypal';
import { sendInvoiceEmail } from '@/lib/email';
import { sendCareerEmail } from '@/lib/career/email';
import type { CareerServiceSlug } from '@/lib/career/types';
import { ClientType } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UpgradeGateway = 'RAZORPAY' | 'PAYPAL' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT';
import { FEE_RATES } from '@/lib/pricing';

const RAZORPAY_DOMESTIC_FEE = FEE_RATES.RAZORPAY_DOMESTIC;
const RAZORPAY_INTL_FEE     = FEE_RATES.RAZORPAY_INTL;
const PAYPAL_FEE            = FEE_RATES.PAYPAL_INTL;
const PAYPAL_FIXED          = 0.30;
const BANK_TRANSFER_NATIVE_FEE = FEE_RATES.BANK_TRANSFER_NATIVE;
const BANK_TRANSFER_SWIFT_FEE = FEE_RATES.BANK_TRANSFER_SWIFT;
const ZERO_DECIMAL = ['INR', 'JPY', 'KRW', 'VND', 'IDR'];

const roundMoney = (v: number, cur: string) => (ZERO_DECIMAL.includes(cur) ? Math.round(v) : Math.round(v * 100) / 100);
const ceilMoney  = (v: number, cur: string) => (ZERO_DECIMAL.includes(cur) ? Math.ceil(v)  : Math.ceil(v * 100) / 100);

function detectIsIndia(currency: string | null, country: string | null): boolean {
  const cur  = (currency ?? 'INR').toUpperCase();
  const ctry = (country  ?? 'IN' ).toUpperCase();
  return ctry === 'IN' || cur === 'INR';
}

interface UpgradePricing {
  gateway: UpgradeGateway;
  currency: string; currencySymbol: string; exchangeRate: number;
  subtotal: number; taxRate: number; taxAmount: number;
  processingFeeRate: number; processingFee: number; totalPayable: number;
}

/**
 * Price a portal upgrade for the chosen gateway.
 *  - India → Razorpay, INR, 18% GST.
 *  - International + Razorpay → charged in the client's LOCAL currency (USD base
 *    × live rate), 0% GST (export of services).
 *  - International + PayPal → charged in USD.
 * `differenceBase` is in the base currency (INR for India, USD otherwise).
 */
async function computeUpgradePricing(
  differenceBase: number,
  isIndia: boolean,
  gateway: UpgradeGateway,
  clientCurrency: string,
): Promise<UpgradePricing> {
  if (isIndia) {
    const taxRate    = 0.18;
    const taxAmount  = roundMoney(differenceBase * taxRate, 'INR');
    const cost       = differenceBase + taxAmount;
    const totalPayable = ceilMoney(cost / (1 - RAZORPAY_DOMESTIC_FEE), 'INR');
    return {
      gateway: 'RAZORPAY', currency: 'INR', currencySymbol: '₹', exchangeRate: 1,
      subtotal: differenceBase, taxRate, taxAmount,
      processingFeeRate: RAZORPAY_DOMESTIC_FEE, processingFee: roundMoney(totalPayable - cost, 'INR'), totalPayable,
    };
  }

  if (gateway === 'RAZORPAY') {
    const { getCurrencyByCode } = require('@/lib/currency');
    const local  = getCurrencyByCode(clientCurrency);
    const rate   = await getExchangeRate('USD', local.code);
    const subtotal     = roundMoney(differenceBase * rate, local.code);
    const totalPayable = ceilMoney(subtotal / (1 - RAZORPAY_INTL_FEE), local.code);
    return {
      gateway: 'RAZORPAY', currency: local.code, currencySymbol: local.symbol, exchangeRate: rate,
      subtotal, taxRate: 0, taxAmount: 0,
      processingFeeRate: RAZORPAY_INTL_FEE, processingFee: roundMoney(totalPayable - subtotal, local.code), totalPayable,
    };
  }

  if (gateway.startsWith('RAZORPAY_INTERNATIONAL_BANK_TRANSFER')) {
    const { getCurrencyByCode } = require('@/lib/currency');
    const local  = getCurrencyByCode(clientCurrency);
    const rate   = await getExchangeRate('USD', local.code);
    const subtotal     = roundMoney(differenceBase * rate, local.code);
    const feeRate = gateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' ? BANK_TRANSFER_NATIVE_FEE : BANK_TRANSFER_SWIFT_FEE;
    const totalPayable = ceilMoney(subtotal / (1 - feeRate), local.code);
    return {
      gateway, currency: local.code, currencySymbol: local.symbol, exchangeRate: rate,
      subtotal, taxRate: 0, taxAmount: 0,
      processingFeeRate: feeRate, processingFee: roundMoney(totalPayable - subtotal, local.code), totalPayable,
    };
  }

  // International PayPal — USD
  const totalPayable = ceilMoney((differenceBase + PAYPAL_FIXED) / (1 - PAYPAL_FEE), 'USD');
  return {
    gateway: 'PAYPAL', currency: 'USD', currencySymbol: '$', exchangeRate: 1,
    subtotal: differenceBase, taxRate: 0, taxAmount: 0,
    processingFeeRate: PAYPAL_FEE, processingFee: round2(totalPayable - differenceBase), totalPayable,
  };
}

// ─── GET — price preview ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const targetUpgrade = searchParams.get('target');
  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS' && targetUpgrade !== 'EXECUTIVE_CONNECT') {
    return NextResponse.json({ error: 'Invalid upgrade target' }, { status: 400 });
  }

  // Premium Plus gating removed, directly accessible

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
  if (targetUpgrade === 'EXECUTIVE_CONNECT' && existingServices.includes('EXECUTIVE_CONNECT')) {
    return NextResponse.json({ error: 'Already have Executive Connect' }, { status: 400 });
  }

  const invoiceData  = client.invoiceLinks[0]?.invoice;
  const clientType   = (invoiceData?.clientType as ClientType) || 'MID_CAREER';
  const isIndia    = detectIsIndia(invoiceData?.currency ?? null, invoiceData?.country ?? null);
  const rawCountry = invoiceData?.country ?? null;
  // International clients choose a gateway (Razorpay recommended); India is always Razorpay.
  const chosenGateway: UpgradeGateway = isIndia
    ? 'RAZORPAY'
    : (searchParams.get('gateway') === 'PAYPAL' ? 'PAYPAL' : 'RAZORPAY');

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

  let differenceBase: number;
  let customTotalPayable: number | null = null;

  if (targetUpgrade === 'PREMIUM_PLUS') {
    const computedBase = targetPrice - currentlyPaid;
    differenceBase = computedBase > 0 ? computedBase : 0;
  } else if (targetUpgrade === 'EXECUTIVE_CONNECT') {
    const { getExecutiveConnectPricingMap } = require('@/lib/systemSettings');
    const pricingMap = await getExecutiveConnectPricingMap();
    const cur = client.currency || (isIndia ? 'INR' : 'USD');
    differenceBase = pricingMap[cur] || pricingMap['USD'] || 100;
    customTotalPayable = differenceBase; // Manual pricing map means exactly this price.
  } else {
    differenceBase = targetPrice - currentlyPaid;
  }
  if (differenceBase <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  const pricing = await computeUpgradePricing(differenceBase, isIndia, chosenGateway, client.currency);
  
  if (customTotalPayable !== null) {
    pricing.totalPayable = customTotalPayable;
    pricing.subtotal = customTotalPayable;
    pricing.taxAmount = 0;
    pricing.processingFee = 0;
  }

  const { currency, currencySymbol, taxRate, taxAmount, processingFee, processingFeeRate, totalPayable } = pricing;

  // For international clients, also price the alternative gateway so the modal
  // can show both options (Razorpay recommended) without another round-trip.
  const gatewayOptions = isIndia ? null : await Promise.all(
    (['RAZORPAY', 'PAYPAL', 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE', 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT'] as UpgradeGateway[]).map(async (g) => {
      const p = await computeUpgradePricing(differenceBase, false, g, client.currency);
      return {
        gateway: g, currency: p.currency, currencySymbol: p.currencySymbol,
        totalPayable: p.totalPayable, recommended: g === 'RAZORPAY',
      };
    })
  );

  // Check for a reusable existing payment link for the CHOSEN gateway
  const upgradeNoteMarker = `Portal automated upgrade. Target: ${targetUpgrade}`;
  const existingInvoice = await db.invoice.findFirst({
    where: {
      clientEmail: client.email,
      notes:    { contains: upgradeNoteMarker },
      dueDate:  { gt: new Date() },
      ...(chosenGateway === 'RAZORPAY'
        ? { razorpayLinkUrl: { not: null } }
        : { paypalPaymentUrl: { not: null } }),
    },
    select: { razorpayLinkUrl: true, paypalPaymentUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  const existingPaymentUrl = chosenGateway === 'RAZORPAY'
    ? (existingInvoice?.razorpayLinkUrl ?? null)
    : (existingInvoice?.paypalPaymentUrl ?? null);

  return NextResponse.json({
    ok: true,
    targetService:  targetUpgrade,
    upgradeLabel:   targetUpgrade === 'FULL_PACKAGE' ? 'Career Booster Package' : (targetUpgrade === 'EXECUTIVE_CONNECT' ? 'Executive Connect' : 'Premium Plus Package'),
    currentPlan,
    whatYouGet,
    differenceBase,
    taxRate,
    taxAmount,
    processingFee,
    processingFeeRate,
    totalPayable,
    gateway: chosenGateway,
    currency,
    currencySymbol,
    isIndia,
    gatewayOptions,
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

  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS' && targetUpgrade !== 'EXECUTIVE_CONNECT') {
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
  if (targetUpgrade === 'EXECUTIVE_CONNECT' && existingServices.includes('EXECUTIVE_CONNECT')) {
    return NextResponse.json({ error: 'Already have Executive Connect' }, { status: 400 });
  }

  const invoiceData = client.invoiceLinks[0]?.invoice;
  const clientType  = (invoiceData?.clientType as ClientType) || 'MID_CAREER';
  const isIndia    = detectIsIndia(invoiceData?.currency ?? null, invoiceData?.country ?? null);
  const rawCountry = invoiceData?.country ?? null;
  const chosenGateway: UpgradeGateway = isIndia
    ? 'RAZORPAY'
    : ((body?.gateway as UpgradeGateway) ?? 'RAZORPAY');

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

  let differenceBase = targetPrice - currentlyPaid;
  let customTotalPayable: number | null = null;
  
  if (targetUpgrade === 'PREMIUM_PLUS') {
    differenceBase = differenceBase > 0 ? differenceBase : 0;
  } else if (targetUpgrade === 'EXECUTIVE_CONNECT') {
    const { getExecutiveConnectPricingMap } = require('@/lib/systemSettings');
    const pricingMap = await getExecutiveConnectPricingMap();
    const cur = client.currency || (isIndia ? 'INR' : 'USD');
    differenceBase = pricingMap[cur] || pricingMap['USD'] || 100;
    customTotalPayable = differenceBase;
  }
  
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
      ...(chosenGateway === 'RAZORPAY'
        ? { razorpayLinkUrl: { not: null } }
        : { paypalPaymentUrl: { not: null } }),
    },
    select: { razorpayLinkUrl: true, paypalPaymentUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  const pricing = await computeUpgradePricing(differenceBase, isIndia, chosenGateway, client.currency);
  
  if (customTotalPayable !== null) {
    pricing.totalPayable = customTotalPayable;
    pricing.subtotal = customTotalPayable;
    pricing.taxAmount = 0;
    pricing.processingFee = 0;
  }
  
  const { currency, currencySymbol, taxRate, taxAmount, processingFee: processingFeeConverted, processingFeeRate, totalPayable } = pricing;

  if (existingInvoice) {
    const existingUrl = chosenGateway === 'RAZORPAY' ? existingInvoice.razorpayLinkUrl : existingInvoice.paypalPaymentUrl;
    if (existingUrl) {
      return NextResponse.json({ ok: true, paymentUrl: existingUrl, differenceBase, totalPayable, reused: true });
    }
  }

  const invoiceDate = new Date();
  const dueDate     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day window

  const upgradeDescription = targetUpgrade === 'FULL_PACKAGE'
    ? 'Upgrade to Complete Career Booster (Resume, LinkedIn, Cover Letter)'
    : (targetUpgrade === 'EXECUTIVE_CONNECT' ? 'Executive Connect Strategy Consultation' : 'Upgrade to Premium Plus Package (Career Booster + Portfolio)');

  // Build one line item per NEW service being added, so onboarding grants exactly
  // what was paid for. (A single combined "Career Booster + Portfolio" line was
  // matched as FULL_PACKAGE and silently dropped the portfolio.) Item prices sum
  // to differenceBase.
  const effectivelyHasResume      = hasResume      || hasFull;
  const effectivelyHasLinkedIn    = hasLinkedIn    || hasFull;
  const effectivelyHasCoverLetter = hasCoverLetter || hasFull;
  const upgradeItems: { description: string; unitPrice: number }[] = [];
  if (!effectivelyHasResume && targetUpgrade !== 'EXECUTIVE_CONNECT')      upgradeItems.push({ description: 'Professional Resume Writing',   unitPrice: basePrices.RESUME[clientType] });
  if (!effectivelyHasLinkedIn && targetUpgrade !== 'EXECUTIVE_CONNECT')    upgradeItems.push({ description: 'LinkedIn Profile Optimisation', unitPrice: basePrices.LINKEDIN[clientType] });
  if (!effectivelyHasCoverLetter && targetUpgrade !== 'EXECUTIVE_CONNECT') upgradeItems.push({ description: 'Cover Letter Writing',          unitPrice: basePrices.COVER_LETTER[clientType] });
  if (targetUpgrade === 'PREMIUM_PLUS' && !hasPortfolio) upgradeItems.push({ description: 'Portfolio Website Development', unitPrice: basePrices.PORTFOLIO[clientType] });
  if (targetUpgrade === 'EXECUTIVE_CONNECT') upgradeItems.push({ description: 'Executive Connect Strategy Consultation', unitPrice: differenceBase });
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
          country:         isIndia ? 'IN' : (rawCountry ?? 'US'),
          currency,
          currencySymbol,
          exchangeRate:    pricing.exchangeRate,
          lineItems: upgradeItems.map((it, i) => {
            const unit = roundMoney(it.unitPrice * pricing.exchangeRate, currency);
            return { id: `upgrade_${i + 1}`, description: it.description, qty: 1, unitPrice: unit, lineTotal: unit };
          }),
          discountRate:          0,
          discountAmount:        0,
          taxRate,
          taxAmount,
          subtotalConverted:     pricing.subtotal,
          processingFeeRate,
          processingFeeConverted,
          totalPayable,
          paymentGateway:        chosenGateway,
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
    if (chosenGateway.startsWith('RAZORPAY_INTERNATIONAL_BANK_TRANSFER')) {
      // Send invoice email with wire instructions
      await sendInvoiceEmail(invoice as any);
      
      // Send reconciliation form link via career email
      const portalAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${portalAppUrl}/portal/reconciliation/${invoice.id}`,
          body: `Your wire transfer invoice has been generated. Please follow the wire instructions in the invoice PDF.\n\nOnce you have transferred the funds, please fill out the reconciliation form with your reference number so we can unlock your services immediately:\n\n${portalAppUrl}/portal/reconciliation/${invoice.id}`,
        }
      });
      return NextResponse.json({ ok: true, isBankTransfer: true, message: 'Invoice and instructions sent via email.', differenceBase, totalPayable });
    } else if (chosenGateway === 'RAZORPAY') {
      // Razorpay — domestic (INR) or international (client's local currency)
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
