// src/lib/sms.ts
// Twilio-based SMS — works for both Indian and international numbers

import type { InvoiceData } from '@/types';
import { formatCurrency } from './pricing';
import { CLIENT_TYPE_LABELS } from './pricing';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  ?? '';
const TWILIO_FROM        = process.env.TWILIO_FROM_NUMBER ?? ''; // e.g. +12015551234

// ─────────────────────────────────────────────
// SEND SMS
// ─────────────────────────────────────────────
export async function sendSMS(to: string, message: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.warn('[SMS] Twilio not configured — skipping SMS to', to);
    return;
  }

  // Ensure E.164 format (+countrycode digits)
  const toE164 = to.startsWith('+') ? to : `+${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const body = new URLSearchParams({
    To:   toE164,
    From: TWILIO_FROM,
    Body: message,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`[SMS] Twilio error: ${JSON.stringify(err)}`);
  }
}

// ─────────────────────────────────────────────
// SMS TEMPLATES
// ─────────────────────────────────────────────

export function buildInvoiceSMS(invoice: InvoiceData): string {
  const firstName = invoice.clientName.split(' ')[0];
  const amount    = formatCurrency(invoice.totalPayable, invoice.currencySymbol);
  const due       = new Date(invoice.dueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const payLink = invoice.razorpayLinkUrl ?? '';

  return [
    `Hi ${firstName},`,
    ``,
    `Your Career Booster invoice ${invoice.invoiceNumber} is ready.`,
    `Package: ${CLIENT_TYPE_LABELS[invoice.clientType]}`,
    `Amount: ${amount} ${invoice.currency}`,
    `Due: ${due}`,
    ``,
    payLink ? `Pay securely: ${payLink}` : '',
    ``,
    `Questions? Email info@theripplenexus.com`,
    `— Ripple Nexus`,
  ].filter(l => l !== undefined).join('\n').trim();
}

export function buildPaymentConfirmationSMS(invoice: InvoiceData): string {
  const firstName = invoice.clientName.split(' ')[0];
  const amount    = formatCurrency(invoice.totalPayable, invoice.currencySymbol);

  return [
    `Hi ${firstName}! Payment confirmed ✓`,
    ``,
    `Invoice: ${invoice.invoiceNumber}`,
    `Amount: ${amount} ${invoice.currency}`,
    ``,
    `We'll begin your Career Booster Package within 24 hours.`,
    `Estimated delivery: 2–4 business days.`,
    ``,
    `Thank you for choosing Ripple Nexus!`,
  ].join('\n').trim();
}
