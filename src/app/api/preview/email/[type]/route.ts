// src/app/api/preview/email/[type]/route.ts
// Dev-only email preview endpoint. Returns 403 in production.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { render } from '@react-email/render';
import * as React from 'react';

import { InvoiceEmail } from '@/emails/invoice/InvoiceEmail';
import { PaymentConfirmationEmail } from '@/emails/invoice/PaymentConfirmationEmail';
import { CheckoutRecoveryEmail } from '@/emails/invoice/CheckoutRecoveryEmail';
import { AdminPaymentAlertEmail } from '@/emails/invoice/AdminPaymentAlertEmail';
import { InquiryConfirmationEmail } from '@/emails/sales/InquiryConfirmationEmail';
import { AdminNewLeadEmail } from '@/emails/sales/AdminNewLeadEmail';

export const dynamic = 'force-dynamic';

const FIXTURE_INVOICE = {
  id: 'fixture-invoice-id',
  invoiceNumber: 'INV-2025-0042',
  clientName: 'Priya Sharma',
  clientEmail: 'priya@example.com',
  clientPhone: '+919876543210',
  clientType: 'MID_CAREER' as const,
  country: 'India',
  companyName: 'Infosys Limited',
  currency: 'INR',
  currencySymbol: '₹',
  exchangeRate: 1,
  lineItems: JSON.stringify([
    { id: '1', description: 'Professional Resume Rewrite', qty: 1, unitPrice: 799, lineTotal: 799 },
    { id: '2', description: 'LinkedIn Profile Optimisation', qty: 1, unitPrice: 549, lineTotal: 549 },
    { id: '3', description: 'Cover Letter (customised)', qty: 1, unitPrice: 0, lineTotal: 0 },
  ]),
  discountRate: 10,
  discountAmount: 134.8,
  taxRate: 0,
  taxAmount: 0,
  resumeBaseInr: 799,
  linkedinBaseInr: 549,
  coverLetterBaseInr: 0,
  resumeConverted: 799,
  linkedinConverted: 549,
  coverLetterConverted: 0,
  subtotalConverted: 1348,
  processingFeeRate: 0.025,
  processingFeeConverted: 30.33,
  totalPayable: 1243.53,
  revisionCount: 0,
  revisionCharge: 0,
  notes: null,
  customPricing: false,
  paymentGateway: 'RAZORPAY',
  paypalInvoiceId: null,
  paypalPaymentUrl: null,
  razorpayLinkUrl: 'https://razorpay.com/payment-link/fixture',
  installmentPlan: false,
  installmentCount: 1,
  installments: [],
  status: 'PENDING' as const,
  paidAt: null,
  invoiceDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  brandId: 'catalyst',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string } }
) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not available in production', { status: 403 });
  }

  const { type } = params;
  let element: React.ReactElement | null = null;

  switch (type) {
    case 'invoice':
      element = React.createElement(InvoiceEmail, { invoice: FIXTURE_INVOICE as any });
      break;

    case 'payment-confirmation':
      element = React.createElement(PaymentConfirmationEmail, {
        invoice: { ...FIXTURE_INVOICE, status: 'PAID', paidAt: new Date().toISOString() } as any,
      });
      break;

    case 'checkout-recovery-1':
    case 'checkout-recovery-2':
    case 'checkout-recovery-3':
    case 'checkout-recovery-4': {
      const lv = parseInt(type.slice(-1)) as 1 | 2 | 3 | 4;
      element = React.createElement(CheckoutRecoveryEmail, { invoice: FIXTURE_INVOICE as any, level: lv });
      break;
    }

    case 'admin-payment-alert':
      element = React.createElement(AdminPaymentAlertEmail, {
        clientName: 'Priya Sharma',
        clientEmail: 'priya@example.com',
        product: 'Career Booster Package',
        amount: 1243.53,
        currency: 'INR',
        currencySymbol: '₹',
        formattedAmount: '₹1,243.53',
        paidAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }),
        razorpayPaymentId: 'pay_fixture123456',
        razorpayOrderId: 'order_fixture654321',
        invoiceNumber: 'INV-2025-0042',
        adminUrl: 'http://localhost:3000/clients/fixture',
        brandId: 'catalyst',
      });
      break;

    case 'inquiry-confirmation':
      element = React.createElement(InquiryConfirmationEmail, {
        name: 'Arjun Mehta',
        email: 'arjun@example.com',
        displayId: 'LD-1042',
        requirementType: 'CAREER_TRANSITION',
        servicesRequested: ['Resume Rewrite', 'LinkedIn Optimisation'],
      });
      break;

    case 'admin-new-lead':
      element = React.createElement(AdminNewLeadEmail, {
        id: 'fixture-lead-id',
        displayId: 'LD-1042',
        name: 'Arjun Mehta',
        email: 'arjun@example.com',
        requirementType: 'CAREER_TRANSITION',
        autoQualScore: 82,
        priority: 'HIGH',
      });
      break;

    default:
      return NextResponse.json(
        {
          error: `Unknown type: ${type}`,
          available: [
            'invoice', 'payment-confirmation',
            'checkout-recovery-1', 'checkout-recovery-2',
            'checkout-recovery-3', 'checkout-recovery-4',
            'admin-payment-alert', 'inquiry-confirmation', 'admin-new-lead',
          ],
        },
        { status: 404 }
      );
  }

  const html = await render(element, { pretty: true });

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
