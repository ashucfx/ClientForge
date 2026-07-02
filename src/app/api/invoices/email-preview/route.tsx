// src/app/api/invoices/email-preview/route.tsx
// Returns the rendered HTML of the invoice email so the admin can preview it
// before sending.  POST so we can accept arbitrary form state without query-string limits.

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { render } from '@react-email/render';
import { InvoiceEmail } from '@/emails/invoice/InvoiceEmail';
import type { InvoiceData, ClientType, LineItem } from '@/types';
import { FEE_RATES, round2 } from '@/lib/pricing';
import { addDays } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const clientName      = String(body.clientName  ?? '');
    const clientEmail     = String(body.clientEmail ?? '');
    const clientType      = (body.clientType ?? 'FRESHER') as ClientType;
    const country         = String(body.country     ?? '');
    const companyName     = body.companyName ? String(body.companyName) : null;
    const currency        = String(body.currency        ?? 'INR');
    const currencySymbol  = String(body.currencySymbol  ?? '₹');
    const exchangeRate    = Number(body.exchangeRate)   || 1;
    const rawItems        = Array.isArray(body.lineItems) ? body.lineItems : [];
    const discountRate    = Number(body.discountRate)  || 0;
    const taxRate         = Number(body.taxRate)       || 0;
    const notes           = body.notes ? String(body.notes) : null;
    const dueDays         = Number(body.dueDays)       || 7;
    const paymentGateway  = String(body.paymentGateway ?? 'RAZORPAY');
    const paypalWillConvertToUsd = Boolean(body.paypalWillConvertToUsd);
    const usdExchangeRate = Number(body.usdExchangeRate) || 83.5;
    const brandId         = String(body.brandId ?? 'catalyst');

    // Normalise line items
    const parsedItems: LineItem[] = rawItems.map((i: Record<string, unknown>) => ({
      id:          String(i.id ?? Math.random().toString(36)),
      description: String(i.description ?? ''),
      qty:         Number(i.qty)       || 1,
      unitPrice:   Number(i.unitPrice) || 0,
      lineTotal:   round2((Number(i.qty) || 1) * (Number(i.unitPrice) || 0)),
    }));

    // Compute totals in the displayed currency
    const grossSubtotal      = round2(parsedItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0));
    const discountAmount     = round2(grossSubtotal * discountRate / 100);
    const afterDiscount      = round2(grossSubtotal - discountAmount);
    const taxAmount          = round2(afterDiscount * taxRate / 100);
    const subtotalConverted  = round2(afterDiscount + taxAmount);
    const processingFeeRate  = currency === 'INR' ? FEE_RATES.INR : FEE_RATES.INTERNATIONAL;
    const processingFeeConverted = round2(subtotalConverted * processingFeeRate);
    const totalPayable       = round2(subtotalConverted + processingFeeConverted);

    // If PayPal falls back to USD, rewrite all amounts to USD (same logic as route.ts)
    let emailCurrency    = currency;
    let emailSymbol      = currencySymbol;
    let emailItems       = parsedItems;
    let emailSubtotal    = subtotalConverted;
    let emailFee         = processingFeeConverted;
    let emailTotal       = totalPayable;
    let emailDiscount    = discountAmount;
    let emailTax         = taxAmount;
    let localCurrencyCode:     string | null = null;
    let localEquivalentAmount: number | null = null;

    if (paypalWillConvertToUsd && usdExchangeRate > 0) {
      const pp = (v: number) => round2(v / usdExchangeRate);
      localCurrencyCode    = currency;
      localEquivalentAmount = totalPayable;
      emailCurrency = 'USD';
      emailSymbol   = '$';
      emailSubtotal = pp(subtotalConverted);
      emailFee      = pp(processingFeeConverted);
      emailTotal    = pp(totalPayable);
      emailDiscount = pp(discountAmount);
      emailTax      = pp(taxAmount);
      emailItems    = parsedItems.map(i => ({
        ...i,
        unitPrice: pp(i.unitPrice),
        lineTotal: pp(i.lineTotal),
      }));
    }

    const now     = new Date();
    const dueDate = addDays(now, dueDays);

    const invoiceData: InvoiceData = {
      id:            'preview',
      invoiceNumber: 'PREVIEW',
      clientName,
      clientEmail,
      clientPhone:   '',
      clientType,
      country,
      companyName,
      currency:        emailCurrency,
      currencySymbol:  emailSymbol,
      exchangeRate,
      lineItems:       emailItems,
      discountRate,
      taxRate,
      discountAmount:  emailDiscount,
      taxAmount:       emailTax,
      // Legacy fields unused in email template
      resumeBaseInr:        0,
      linkedinBaseInr:      0,
      coverLetterBaseInr:   0,
      resumeConverted:      0,
      linkedinConverted:    0,
      coverLetterConverted: 0,
      subtotalConverted:    emailSubtotal,
      processingFeeRate,
      processingFeeConverted: emailFee,
      totalPayable:           emailTotal,
      revisionCount:  0,
      revisionCharge: 0,
      notes,
      customPricing:  false,
      paymentGateway,
      paypalInvoiceId:  null,
      paypalPaymentUrl: paymentGateway === 'PAYPAL'    ? '#preview-pay' : null,
      localCurrencyCode,
      localEquivalentAmount,
      installmentPlan:  false,
      installmentCount: 1,
      installments:     [],
      status:            'PENDING',
      razorpayLinkId:    null,
      razorpayLinkUrl:   paymentGateway === 'RAZORPAY' ? '#preview-pay' : null,
      razorpayPaymentId: null,
      paidAt:            null,
      invoiceDate: now,
      dueDate,
      brandId,
      rnServiceId:      null,
      emailSentAt:      null,
      emailResendCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const html = await render(React.createElement(InvoiceEmail, { invoice: invoiceData }));
    return NextResponse.json({ html });
  } catch (err) {
    console.error('[email-preview]', err);
    return NextResponse.json(
      { error: 'Failed to render email preview', detail: String(err) },
      { status: 500 },
    );
  }
}
