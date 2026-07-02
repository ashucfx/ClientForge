// src/app/api/invoices/route.ts
// @deprecated For tenant-specific requests, use:
//   - /api/catalyst/invoices  → Catalyst invoices (requires activeTenant=catalyst in JWT)
//   - /api/rn/invoices        → Ripple Nexus invoices (requires activeTenant=ripple_nexus in JWT)
// This endpoint remains active for SUPER_ADMIN cross-brand views ('all' mode) only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrencyForCountry, getExchangeRate } from '@/lib/currency';
import { FEE_RATES, round2 } from '@/lib/pricing';
import { createRazorpayPaymentLink, createRazorpayInstallmentLink } from '@/lib/razorpay';
import { createPaypalInvoice, createPaypalInstallmentInvoice, PAYPAL_SUPPORTED_CURRENCIES } from '@/lib/paypal';
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import { sendInvoiceEmail } from '@/lib/email';
import { normalizePhoneE164 } from '@/lib/phone';
import { getAdminSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit/logger';
import { z } from 'zod';
import { addDays } from 'date-fns';
import { headers } from 'next/headers';
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
  brandId:          z.enum(['catalyst', 'ripple_nexus']).default('catalyst'),
  rnServiceId:      z.string().optional(),
  clientName:       z.string().min(2),
  clientEmail:      z.string().email(),
  clientPhone:      z.string().min(6),
  companyName:      z.string().optional(),
  country:          z.string().min(2),
  clientType:       z.enum(['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS', 'AGENCY_CLIENT']),
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
  const session = await getAdminSession();
  if (!session) {
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

  // ── RBAC Brand Enforcement ──
  const { role, brandAccess } = session;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  
  const brandId = searchParams.get('brandId');
  if (brandId) {
    if (!isSuperAdmin && !brandAccess.includes(brandId)) {
      console.log('API INVOICES 403:', { isSuperAdmin, brandAccess, brandId });
      return NextResponse.json({ error: 'Unauthorized brand access' }, { status: 403 });
    }
    where.brandId = brandId;
  } else if (!isSuperAdmin) {
    where.brandId = { in: brandAccess };
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
    const body   = await request.json();
    const parsed = CreateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const {
      brandId,
      rnServiceId,
      clientName, clientEmail, clientPhone, companyName,
      country, clientType, currencyOverride,
      paymentGateway: requestedGateway,
      installmentCount,
      lineItems, discountRate, taxRate, notes, dueDays,
    } = parsed.data;

    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { role, brandAccess } = session;

    if (role !== 'SUPER_ADMIN' && !brandAccess.includes(brandId)) {
      return NextResponse.json({ error: 'Unauthorized to create invoice for this brand' }, { status: 403 });
    }

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
    const exchangeRate     = await getExchangeRate('INR', currencyCode);

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
    const gateway: 'RAZORPAY' | 'PAYPAL' = requestedGateway ?? 'RAZORPAY';

    // ── Create invoice record (draft) ──
    let invoice;
    let createError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const invoiceNumber = await getNextInvoiceNumber();
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            brandId,
            rnServiceId: brandId === 'ripple_nexus' ? rnServiceId : undefined,
            clientName, clientEmail, clientPhone: normalizedPhone.e164, clientType,
            country, companyName,
            currency: currencyCode, currencySymbol, exchangeRate,
            lineItems:             safeItems as object[],
            invoiceLineItems: {
              create: safeItems.map(i => ({
                description: i.description,
                qty: i.qty,
                unitPrice: i.unitPrice,
                lineTotal: i.lineTotal
              }))
            },
            discountRate, taxRate, discountAmount, taxAmount,
            subtotalConverted, processingFeeRate, processingFeeConverted, totalPayable,
            notes, invoiceDate, dueDate,
            installmentPlan:  isSplit,
            installmentCount: installmentCount,
          },
        });
        break; // Success! Break out of the loop
      } catch (err: any) {
        // P2002 is Prisma's unique constraint violation code
        if (err.code === 'P2002') {
          createError = err;
          if (attempt < 3) {
            // Wait briefly before retrying to allow the concurrent thread to finish
            await new Promise(r => setTimeout(r, 100 * attempt));
            continue;
          }
        }
        throw err; // Throw if not P2002 or out of retries
      }
    }

    if (!invoice) {
      throw createError || new Error('Failed to create invoice after retries');
    }

    // ── Create payment link(s) ───────────────────────────────────
    let gatewayUpdate: Record<string, unknown> = { paymentGateway: gateway };

    // PayPal only supports ~25 currencies. For unsupported ones (e.g. AED, SAR), convert to USD.
    // When falling back, we rewrite the invoice currency to USD and store the local equivalent.
    let ppCurrencyCode = currencyCode;
    let ppConvertFactor = 1;
    let paypalFellBackToUsd = false;
    if (gateway === 'PAYPAL' && !PAYPAL_SUPPORTED_CURRENCIES.has(currencyCode)) {
      const usdRate = await getExchangeRate(currencyCode, 'USD');
      ppCurrencyCode = 'USD';
      ppConvertFactor = usdRate;
      paypalFellBackToUsd = true;
    }
    const ppConvert = (amount: number) => round2(amount * ppConvertFactor);

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
            currency: ppCurrencyCode, dueDate: invoice.dueDate, notes: invoice.notes,
            lineItems: (safeItems as LineItem[]).map(i => ({ description: i.description, qty: i.qty, unitPrice: ppConvert(i.unitPrice) })),
            taxAmount: invoice.taxAmount ? ppConvert(invoice.taxAmount) : undefined,
            discountAmount: invoice.discountAmount ? ppConvert(invoice.discountAmount) : undefined,
            processingFeeAmount: invoice.processingFeeConverted ? ppConvert(invoice.processingFeeConverted) : undefined,
          });
          gatewayUpdate = {
            paymentGateway: 'PAYPAL',
            paypalInvoiceId: pp.id,
            paypalPaymentUrl: pp.paymentUrl,
            // When PayPal falls back to USD, rewrite invoice currency so email/display is consistent
            ...(paypalFellBackToUsd && {
              currency: 'USD',
              currencySymbol: '$',
              totalPayable: ppConvert(totalPayable),
              subtotalConverted: ppConvert(invoice.subtotalConverted),
              processingFeeConverted: ppConvert(invoice.processingFeeConverted),
              discountAmount: ppConvert(invoice.discountAmount),
              taxAmount: ppConvert(invoice.taxAmount),
              // Convert each line item to USD so email shows correct per-service USD prices
              lineItems: safeItems.map(i => ({
                ...i,
                unitPrice: ppConvert(i.unitPrice),
                lineTotal: ppConvert(i.lineTotal),
              })),
              localCurrencyCode: currencyCode,
              localEquivalentAmount: totalPayable,
            }),
          };
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
                currency: ppCurrencyCode, dueDate: instDue, notes: invoice.notes,
                lineItems: [],
              },
              seq, ppConvert(amount), instDue,
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
          // When PayPal falls back to USD for split payments, rewrite invoice currency too
          ...(paypalFellBackToUsd && {
            currency: 'USD',
            currencySymbol: '$',
            totalPayable: ppConvert(totalPayable),
            subtotalConverted: ppConvert(invoice.subtotalConverted),
            processingFeeConverted: ppConvert(invoice.processingFeeConverted),
            discountAmount: ppConvert(invoice.discountAmount),
            taxAmount: ppConvert(invoice.taxAmount),
            lineItems: safeItems.map(i => ({
              ...i,
              unitPrice: ppConvert(i.unitPrice),
              lineTotal: ppConvert(i.lineTotal),
            })),
            localCurrencyCode: currencyCode,
            localEquivalentAmount: totalPayable,
          }),
          invoiceInstallments: {
            create: installs.map(i => ({
              seq:            i.seq,
              amount:         i.amount,
              dueDate:        new Date(i.dueDate),
              status:         i.status,
              // Store paypalInvoiceId on the row for O(1) webhook lookup
              ...(i.paypalInvoiceId ? { paypalInvoiceId: i.paypalInvoiceId } : {}),
            }))
          },
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
      await prisma.sysEmailLog.create({
        data: {
          to: fullInvoice.clientEmail,
          subject: `Invoice ${fullInvoice.invoiceNumber} — ${fullInvoice.currencySymbol}${fullInvoice.totalPayable}`,
          trigger: 'INVOICE_SENT',
          channel: 'resend',
          status: 'sent',
          metadata: { invoiceId: fullInvoice.id, invoiceNumber: fullInvoice.invoiceNumber, amount: fullInvoice.totalPayable, currency: fullInvoice.currency },
        },
      }).catch(() => {}); // non-blocking — don't fail invoice creation over a log write
    } catch (emailErr) {
      console.error('[Email] Invoice email failed:', emailErr);
      await prisma.sysEmailLog.create({
        data: {
          to: fullInvoice.clientEmail,
          subject: `Invoice ${fullInvoice.invoiceNumber}`,
          trigger: 'INVOICE_SENT',
          channel: 'resend',
          status: 'failed',
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          metadata: { invoiceId: fullInvoice.id, invoiceNumber: fullInvoice.invoiceNumber },
        },
      }).catch(() => {});
    }

    await logAudit(
      { tenantId: brandId, adminId: session.adminId, role: session.role, brandAccess: session.brandAccess },
      'INVOICE_CREATED',
      'Invoice',
      fullInvoice.id,
      { invoiceNumber: fullInvoice.invoiceNumber, amount: fullInvoice.totalPayable }
    );

    return NextResponse.json({ invoice: fullInvoice }, { status: 201 });
  } catch (err) {
    console.error('Create invoice error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
