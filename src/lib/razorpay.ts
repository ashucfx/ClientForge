// src/lib/razorpay.ts

import { toSmallestUnit } from './pricing';
import type { InvoiceData, RazorpayPaymentLinkResponse } from '@/types';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

function getAuthHeader(): string {
  const creds = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${creds}`;
}

// ─────────────────────────────────────────────
// CREATE RAZORPAY PAYMENT LINK
// ─────────────────────────────────────────────
export async function createRazorpayPaymentLink(
  invoice: InvoiceData
): Promise<RazorpayPaymentLinkResponse> {
  const amountInSmallestUnit = toSmallestUnit(invoice.totalPayable, invoice.currency);

  const payload = {
    amount: amountInSmallestUnit,
    currency: invoice.currency,
    accept_partial: false,
    description: `Career Booster Package — Invoice ${invoice.invoiceNumber}`,
    customer: {
      name: invoice.clientName,
      email: invoice.clientEmail,
      contact: invoice.clientPhone,
    },
    notify: {
      sms: true,
      email: true,
    },
    reminder_enable: true,
    notes: {
      invoice_number: invoice.invoiceNumber,
      client_type: invoice.clientType,
      invoice_id: invoice.id,
    },
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/razorpay/callback`,
    callback_method: 'get',
    expire_by: Math.floor(new Date(invoice.dueDate).getTime() / 1000),
  };

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Razorpay API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  
  return {
    id: data.id,
    short_url: data.short_url,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
  };
}

// ─────────────────────────────────────────────
// VERIFY RAZORPAY WEBHOOK SIGNATURE
// ─────────────────────────────────────────────
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

// ─────────────────────────────────────────────
// FETCH PAYMENT LINK STATUS
// ─────────────────────────────────────────────
export async function fetchPaymentLinkStatus(linkId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch payment link status');
  }

  return response.json();
}
