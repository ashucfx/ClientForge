// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrencyForCountry, getExchangeRate } from '@/lib/currency';
import { generateInvoiceNumber, FEE_RATES, round2 } from '@/lib/pricing';
import { createRazorpayPaymentLink, createRazorpayInstallmentLink } from '@/lib/razorpay';
import { createPaypalInvoice, createPaypalInstallmentInvoice } from '@/lib/paypal';
import { sendInvoiceEmail } from '@/lib/email';
import { normalizePhoneE164 } from '@/lib/phone';
import { isAdminRequest } from '@/lib/auth';
import { z } from 'zod';
import { addDays } from 'date-fns';
import type { LineItem, Installment } from '@/types';

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
  clientName:       z.string().min(2),
  clientEmail:      z.string().email(),
  clientPhone:      z.string().min(6),
  companyName:      z.string().optional(),
  country:          z.string().min(2),
  clientType:       z.enum(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS']),
  currencyOverride: z.string().optional(),
  paymentGateway:   z.enum(['RAZORPAY', 'PAYPAL']).optional(),
  installmentCount: z.number().int().min(1).max(3).default(1), // 1 = full, 2 = split 2, 3 = split 3
  lineItems:        z.array(LineItemSchema).min(1),
  discountRate:     z.number().min(0).max(100).default(0),
  taxRate:          z.number().min(0).max(100).default(0),
  notes:            z.string().optional(),
  dueDays:          z.number().min(1).max(90).default(7),
});

// ─── Helpers ──────────────────────────────────
/** Split totalPayable into N equal parts (last part absorbs rounding) */
function splitAmount(total: number, count: number): number[] {
  const slice = round2(Math.floor((total / count) * 100) / 100);
  const parts = Array(count).fill(slice);
  parts[count - 1] = round2(total - slice * (count - 1));
  return parts;
}

// ─── GET /api/invoices ─────────────────────────
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const status     = searchParams.get('status');
  const clientType = searchParams.get('clientType');
  const search     = searchParams.get('search');
  const pageParsed  = Number(searchParams.get('page') ?? '1');
  const limitParsed = Number(searchParams.get('limit') ?? '50');
  const page  = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(100, Math.floor(limitParsed)) : 50;

  const allowedStatus = new Set(['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'EXPIRED']);
  const allowedClientType = new Set(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS']);
  if (status && !allowedStatus.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }
  if (clientType && !allowedClientType.has(clientType)) {
    return NextResponse.json({ error: 'Invalid clientType filter' }, { status: 400 });
  }

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
    prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
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
      paymentGateway: requestedGateway,
      installmentCount,
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

    // ── Recalculate line totals server-side ──
    const safeItems: LineItem[] = lineItems.map(item => ({
      ...item,
      lineTotal: round2(item.qty * item.unitPrice),
    }));

    const grossSubtotal = round2(safeItems.reduce((s, i) => s + i.lineTotal, 0));
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

    const invoiceDate    = new Date();
    const dueDate        = addDays(invoiceDate, dueDays);
    const isSplit        = installmentCount > 1;
    const gateway: 'RAZORPAY' | 'PAYPAL' =
      currencyCode === 'INR' ? 'RAZORPAY' : (requestedGateway ?? 'PAYPAL');

    // ── Create invoice record (draft) ──
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber:    generateInvoiceNumber(),
        clientName, clientEmail, clientPhone: normalizedPhone.e164, clientType,
        country, companyName,
        currency: currencyCode, currencySymbol, exchangeRate,
        lineItems:             safeItems as object[],
        discountRate, taxRate, discountAmount, taxAmount,
        subtotalConverted, processingFeeRate, processingFeeConverted, totalPayable,
        notes, invoiceDate, dueDate,
        installmentPlan:  isSplit,
        installmentCount: installmentCount,
      },
    });

    // ── Create payment link(s) ───────────────────────────────────
    let gatewayUpdate: Record<string, unknown> = { paymentGateway: gateway };

    try {
      if (!isSplit) {
        // ── Single payment ──
        if (gateway === 'RAZORPAY') {
          const rzp = await createRazorpayPaymentLink(invoice as unknown as Parameters<typeof createRazorpayPaymentLink>[0]);
          gatewayUpdate = { paymentGateway: 'RAZORPAY', razorpayLinkId: rzp.id, razorpayLinkUrl: rzp.short_url };
        } else {
          const pp = await createPaypalInvoice({
            id: invoice.id, invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.clientName, clientEmail: invoice.clientEmail,
            currency: invoice.currency, dueDate: invoice.dueDate, notes: invoice.notes,
            lineItems: (safeItems as LineItem[]).map(i => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice })),
          });
          gatewayUpdate = { paymentGateway: 'PAYPAL', paypalInvoiceId: pp.id, paypalPaymentUrl: pp.paymentUrl };
        }
      } else {
        // ── Split payment — create N links ──
        const amounts  = splitAmount(totalPayable, installmentCount);
        const installs: Installment[] = [];

        for (let i = 0; i < installmentCount; i++) {
          const seq      = i + 1;
          const amount   = amounts[i];
          // Stagger due dates evenly across dueDays
          const instDue  = addDays(invoiceDate, Math.round(dueDays * (seq / installmentCount)));

          if (gateway === 'RAZORPAY') {
            const rzp = await createRazorpayInstallmentLink(
              invoice as unknown as Parameters<typeof createRazorpayInstallmentLink>[0],
              seq, amount, instDue,
            );
            installs.push({
              seq, amount, dueDate: instDue.toISOString(), status: 'PENDING',
              razorpayLinkId: rzp.id, razorpayLinkUrl: rzp.short_url,
            });
          } else {
            const pp = await createPaypalInstallmentInvoice(
              {
                id: invoice.id, invoiceNumber: invoice.invoiceNumber,
                clientName: invoice.clientName, clientEmail: invoice.clientEmail,
                currency: invoice.currency, dueDate: instDue, notes: invoice.notes,
                lineItems: [],
              },
              seq, amount, instDue,
            );
            installs.push({
              seq, amount, dueDate: instDue.toISOString(), status: 'PENDING',
              paypalInvoiceId: pp.id, paypalPaymentUrl: pp.paymentUrl,
            });
          }
        }

        // First installment's link is the primary link on the invoice
        gatewayUpdate = {
          paymentGateway: gateway,
          installments: installs as object[],
          ...(gateway === 'RAZORPAY'
            ? { razorpayLinkId: installs[0].razorpayLinkId, razorpayLinkUrl: installs[0].razorpayLinkUrl }
            : { paypalInvoiceId: installs[0].paypalInvoiceId, paypalPaymentUrl: installs[0].paypalPaymentUrl }),
        };
      }
    } catch (gwErr) {
      await prisma.invoice.delete({ where: { id: invoice.id } }).catch(() => {});
      const detail = gwErr instanceof Error ? gwErr.message : String(gwErr);
      console.error(`[${gateway}] Payment link creation failed:`, detail);
      return NextResponse.json({ error: `Payment link creation failed (${gateway}) — ${detail}` }, { status: 422 });
    }

    const fullInvoice = await prisma.invoice.update({ where: { id: invoice.id }, data: gatewayUpdate });

    // ── Send email ──
    try {
      await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { emailSentAt: new Date() } });
    } catch (emailErr) {
      console.error('[Email] Invoice email failed:', emailErr);
    }

    return NextResponse.json({ invoice: fullInvoice }, { status: 201 });
  } catch (err) {
    console.error('Create invoice error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
