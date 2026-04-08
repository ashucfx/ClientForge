// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrencyForCountry, getExchangeRate } from '@/lib/currency';
import { generateInvoiceNumber, FEE_RATES, round2 } from '@/lib/pricing';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { sendInvoiceEmail } from '@/lib/email';
import { normalizePhoneE164 } from '@/lib/phone';
import { isAdminRequest } from '@/lib/auth';
import { z } from 'zod';
import { addDays } from 'date-fns';
import type { LineItem } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Validation ────────────────────────────────
const LineItemSchema = z.object({
  id:          z.string(),
  description: z.string().min(1),
  qty:         z.number().min(0.01),
  unitPrice:   z.number().min(0),
  lineTotal:   z.number(),
});

const CreateInvoiceSchema = z.object({
  clientName:   z.string().min(2),
  clientEmail:  z.string().email(),
  clientPhone:  z.string().min(6),
  companyName:  z.string().optional(),
  country:      z.string().min(2),
  clientType:   z.enum(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS']),
  currencyOverride: z.string().optional(),
  lineItems:    z.array(LineItemSchema).min(1),
  discountRate: z.number().min(0).max(100).default(0),
  taxRate:      z.number().min(0).max(100).default(0),
  notes:        z.string().optional(),
  dueDays:      z.number().min(1).max(90).default(7),
});

// ─── GET /api/invoices ─────────────────────────
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const status     = searchParams.get('status');
  const clientType = searchParams.get('clientType');
  const search     = searchParams.get('search');
  const page       = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));

  const where: Record<string, unknown> = {};
  if (status)     where.status     = status;
  if (clientType) where.clientType = clientType;
  if (search) {
    where.OR = [
      { clientName:    { contains: search, mode: 'insensitive' } },
      { clientEmail:   { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { companyName:   { contains: search, mode: 'insensitive' } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ invoices, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

// ─── POST /api/invoices ────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body   = await request.json();
    const parsed = CreateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const {
      clientName, clientEmail, clientPhone, companyName,
      country, clientType, currencyOverride,
      lineItems, discountRate, taxRate, notes, dueDays,
    } = parsed.data;

    const normalizedPhone = normalizePhoneE164(clientPhone, country);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number. Select the correct country and enter a valid mobile number (or include +country code).' },
        { status: 400 }
      );
    }

    // ── Currency resolution ──
    const detectedCurrency = getCurrencyForCountry(country);
    const currencyCode     = currencyOverride ?? detectedCurrency.code;
    const currencySymbol   = detectedCurrency.symbol;
    const exchangeRate     = await getExchangeRate(currencyCode);

    // ── Recalculate line totals server-side (trust server math) ──
    const safeItems: LineItem[] = lineItems.map(item => ({
      ...item,
      lineTotal: round2(item.qty * item.unitPrice),
    }));

    const grossSubtotal  = round2(safeItems.reduce((s, i) => s + i.lineTotal, 0));

    if (grossSubtotal <= 0) {
      return NextResponse.json({ error: 'Invoice total must be greater than zero' }, { status: 400 });
    }

    const discountAmount    = round2(grossSubtotal * discountRate / 100);
    const afterDiscount     = round2(grossSubtotal - discountAmount);
    const taxAmount         = round2(afterDiscount * taxRate / 100);
    const subtotalConverted = round2(afterDiscount + taxAmount);

    const processingFeeRate      = currencyCode === 'INR' ? FEE_RATES.INR : FEE_RATES.INTERNATIONAL;
    const processingFeeConverted = round2(subtotalConverted * processingFeeRate);
    const totalPayable           = round2(subtotalConverted + processingFeeConverted);

    // ── Dates ──
    const invoiceDate = new Date();
    const dueDate     = addDays(invoiceDate, dueDays);

    // ── Create invoice ──
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        clientName, clientEmail, clientPhone: normalizedPhone.e164, clientType,
        country, companyName,
        currency: currencyCode, currencySymbol, exchangeRate,
        lineItems: safeItems as object[],
        discountRate, taxRate, discountAmount, taxAmount,
        subtotalConverted,
        processingFeeRate,
        processingFeeConverted,
        totalPayable,
        notes,
        invoiceDate, dueDate,
      },
    });

    // ── Razorpay link ──
    let razorpayLinkId: string | null  = null;
    let razorpayLinkUrl: string | null = null;
    let razorpayError: string | null   = null;
    try {
      const rzp = await createRazorpayPaymentLink(invoice as unknown as Parameters<typeof createRazorpayPaymentLink>[0]);
      razorpayLinkId  = rzp.id;
      razorpayLinkUrl = rzp.short_url;
      await prisma.invoice.update({ where: { id: invoice.id }, data: { razorpayLinkId, razorpayLinkUrl } });
    } catch (e) {
      razorpayError = e instanceof Error ? e.message : String(e);
      console.error('Razorpay link failed:', razorpayError);
    }

    const fullInvoice = { ...invoice, razorpayLinkId, razorpayLinkUrl };

    // ── Send email ──
    try {
      await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { emailSentAt: new Date() } });
    } catch (e) { console.error('Email failed:', e); }

    return NextResponse.json({
      invoice: fullInvoice,
      ...(razorpayError ? { razorpayError } : {}),
    }, { status: 201 });
  } catch (err) {
    console.error('Create invoice error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
