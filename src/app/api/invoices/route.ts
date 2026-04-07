// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrencyForCountry, getExchangeRate } from '@/lib/currency';
import {
  calculatePricing,
  generateInvoiceNumber,
  CLIENT_TYPE_LABELS,
} from '@/lib/pricing';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { sendInvoiceEmail } from '@/lib/email';
import { z } from 'zod';
import { addDays } from 'date-fns';

const CreateInvoiceSchema = z.object({
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(6),
  country: z.string().min(2),
  clientType: z.enum(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS']),
  currencyOverride: z.string().optional(),
  services: z.object({
    resume: z.boolean(),
    linkedin: z.boolean(),
    coverLetter: z.boolean(),
  }),
});

// ─────────────────────────────────────────────
// GET /api/invoices
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const clientType = searchParams.get('clientType');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (clientType) where.clientType = clientType;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ─────────────────────────────────────────────
// POST /api/invoices
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientName, clientEmail, clientPhone, country, clientType, currencyOverride, services } =
      parsed.data;

    // Currency detection
    const detectedCurrency = getCurrencyForCountry(country);
    const currencyCode = currencyOverride ?? detectedCurrency.code;
    const currencyInfo = currencyOverride
      ? { code: currencyOverride, symbol: detectedCurrency.symbol, name: detectedCurrency.name }
      : detectedCurrency;

    // Get exchange rate (INR → target currency)
    const exchangeRate = await getExchangeRate(currencyCode);

    // Calculate pricing
    const pricing = calculatePricing(clientType, currencyCode, exchangeRate, services);

    if (pricing.totalPayable <= 0) {
      return NextResponse.json(
        { error: 'At least one service must be selected' },
        { status: 400 }
      );
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();
    const invoiceDate = new Date();
    const dueDate = addDays(invoiceDate, 7);

    // Create invoice in DB (without payment link first)
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientName,
        clientEmail,
        clientPhone,
        clientType,
        country,
        currency: currencyCode,
        currencySymbol: currencyInfo.symbol,
        exchangeRate,
        resumeBaseInr: pricing.resumeBaseInr,
        linkedinBaseInr: pricing.linkedinBaseInr,
        coverLetterBaseInr: pricing.coverLetterBaseInr,
        resumeConverted: pricing.resumeConverted,
        linkedinConverted: pricing.linkedinConverted,
        coverLetterConverted: pricing.coverLetterConverted,
        subtotalConverted: pricing.subtotalConverted,
        processingFeeRate: pricing.processingFeeRate,
        processingFeeConverted: pricing.processingFeeConverted,
        totalPayable: pricing.totalPayable,
        invoiceDate,
        dueDate,
      },
    });

    // Create Razorpay payment link
    let razorpayLinkId: string | null = null;
    let razorpayLinkUrl: string | null = null;

    try {
      const rzpLink = await createRazorpayPaymentLink(invoice as any);
      razorpayLinkId = rzpLink.id;
      razorpayLinkUrl = rzpLink.short_url;

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { razorpayLinkId, razorpayLinkUrl },
      });
    } catch (rzpError) {
      console.error('Razorpay link creation failed:', rzpError);
      // Continue without payment link — can be retried
    }

    const fullInvoice = {
      ...invoice,
      razorpayLinkId,
      razorpayLinkUrl,
    };

    // Send email
    try {
      await sendInvoiceEmail(fullInvoice as any);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { emailSentAt: new Date() },
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Non-critical — invoice is created
    }

    return NextResponse.json({ invoice: fullInvoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
