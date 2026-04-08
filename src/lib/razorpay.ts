// src/lib/razorpay.ts

import { toSmallestUnit } from './pricing';
import type { InvoiceData, RazorpayPaymentLinkResponse } from '@/types';
import { normalizePhoneE164, toRazorpayContact } from '@/lib/phone';

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID!;
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
  const normalizedPhone = normalizePhoneE164(invoice.clientPhone, invoice.country);
  const contact = toRazorpayContact(normalizedPhone?.e164 ?? invoice.clientPhone);

  const payload = {
    amount: amountInSmallestUnit,
    currency: invoice.currency,
    accept_partial: false,
    description: `Career Booster Package — Invoice ${invoice.invoiceNumber}`,
    customer: {
      name: invoice.clientName,
      email: invoice.clientEmail,
      contact,
    },
    notify: { sms: true, email: true },
    reminder_enable: true,
    notes: {
      invoice_number: invoice.invoiceNumber,
      client_type:    invoice.clientType,
      invoice_id:     invoice.id,
    },
    callback_url:    `${process.env.NEXT_PUBLIC_APP_URL}/api/razorpay/callback`,
    callback_method: 'get',
    expire_by:       Math.floor(new Date(invoice.dueDate).getTime() / 1000),
  };

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Razorpay API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    id:        data.id,
    short_url: data.short_url,
    amount:    data.amount,
    currency:  data.currency,
    status:    data.status,
  };
}

// ─────────────────────────────────────────────
// CANCEL RAZORPAY PAYMENT LINK
// Returns true on success, false if already cancelled/expired (non-fatal)
// ─────────────────────────────────────────────
export async function cancelRazorpayPaymentLink(linkId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/payment_links/${linkId}/cancel`,
      {
        method:  'POST',
        headers: { Authorization: getAuthHeader() },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      // 400 with "Payment Link is already cancelled/expired" is non-fatal
      const msg: string = err?.error?.description ?? '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('expired')) {
        return false;
      }
      throw new Error(`Razorpay cancel error: ${JSON.stringify(err)}`);
    }
    return true;
  } catch (e) {
    // Best-effort — don't block local operations if Razorpay is unreachable
    console.warn('Razorpay cancel link warning:', e);
    return false;
  }
}

// ─────────────────────────────────────────────
// VERIFY RAZORPAY WEBHOOK SIGNATURE
// ─────────────────────────────────────────────
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    headers: { Authorization: getAuthHeader() },
  });
  if (!response.ok) throw new Error('Failed to fetch payment link status');
  return response.json();
}
