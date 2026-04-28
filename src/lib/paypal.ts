// src/lib/paypal.ts
// PayPal Invoicing API v2 — create, send, cancel, status, webhook verification

import { BRAND_WEBSITE_URL } from './config';

export const PAYPAL_API =
  process.env.PAYPAL_ENV === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

const CLIENT_ID     = process.env.PAYPAL_CLIENT_ID!;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID ?? '';

async function readPaypalError(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => ({}));
  }
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function hasPaypalIssue(err: unknown, issue: string): boolean {
  const details = (err as any)?.details;
  if (!Array.isArray(details)) return false;
  return details.some(d => (d as any)?.issue === issue);
}

// ─── Access token cache (in-memory, per cold start) ──────────────
let _cachedToken:   string | null = null;
let _tokenExpiresAt: number       = 0;

export async function getPaypalAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) {
    return _cachedToken;
  }
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${creds}`,
      Accept:         'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`PayPal auth failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  _cachedToken    = data.access_token as string;
  _tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000;
  return _cachedToken;
}

// ─── Types ───────────────────────────────────────────────────────
export interface PaypalInvoiceResult {
  id:         string;   // PayPal invoice ID e.g. INV2-XXXX-XXXX-XXXX-XXXX
  paymentUrl: string;   // hosted payer-view URL
}

export interface PaypalInvoiceInput {
  id:            string;   // our DB invoice id (used as idempotency key)
  invoiceNumber: string;
  clientName:    string;
  clientEmail:   string;
  currency:      string;
  dueDate:       Date | string;
  notes?:        string | null;
  lineItems: Array<{
    description: string;
    qty:         number;
    unitPrice:   number;
  }>;
}

// ─── CREATE + SEND PayPal invoice ────────────────────────────────
// Creates a draft, sends it (so PayPal activates the payer-view link),
// then fetches the invoice to get the payment URL.
export async function createPaypalInvoice(
  invoice: PaypalInvoiceInput
): Promise<PaypalInvoiceResult> {
  const token = await getPaypalAccessToken();

  const dueDateStr =
    typeof invoice.dueDate === 'string'
      ? invoice.dueDate.split('T')[0]
      : invoice.dueDate.toISOString().split('T')[0];

  // 1️⃣ Create draft invoice
  const createRes = await fetch(`${PAYPAL_API}/v2/invoicing/invoices`, {
    method:  'POST',
    headers: {
      Authorization:       `Bearer ${token}`,
      Accept:              'application/json',
      'Content-Type':      'application/json',
      'PayPal-Request-Id': `rn-inv-${invoice.id}`, // idempotency
    },
    body: JSON.stringify({
      detail: {
        invoice_number: invoice.invoiceNumber,
        currency_code:  invoice.currency,
        payment_term: {
          term_type: 'DUE_ON_DATE_SPECIFIED',
          due_date:  dueDateStr,
        },
        ...(invoice.notes ? { note: invoice.notes } : (() => {
          // Append free items as a note so client sees them even though PayPal excludes $0 lines
          const freeItems = invoice.lineItems.filter(i => i.unitPrice === 0 && i.qty > 0);
          return freeItems.length > 0
            ? { note: `Included free: ${freeItems.map(i => i.description).join(', ')}` }
            : {};
        })()),
        memo: `Career Booster Package — ${invoice.invoiceNumber}`,
      },
      invoicer: {
        name:    { full_name: 'Catalyst' },
        website: BRAND_WEBSITE_URL,
      },
      primary_recipients: [
        {
          billing_info: {
            name:          { full_name: invoice.clientName },
            email_address: invoice.clientEmail,
          },
        },
      ],
      items: invoice.lineItems
        .filter(i => i.qty > 0 && i.unitPrice > 0) // PayPal Live rejects zero-value items
        .map(item => ({
          name:     item.description,
          quantity: String(item.qty),
          unit_amount: {
            currency_code: invoice.currency,
            value:         item.unitPrice.toFixed(2),
          },
        })),
      configuration: {
        allow_tip:                      false,
        tax_calculated_after_discount:  true,
        tax_inclusive:                  false,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await readPaypalError(createRes);
    throw new Error(`PayPal create invoice failed: ${JSON.stringify(err)}`);
  }

  // PayPal returns the canonical invoice ID in the Location header
  // e.g. https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-XXXX-XXXX-XXXX-XXXX
  const location = createRes.headers.get('location') ?? '';
  const draft    = await createRes.json().catch(() => ({}));
  const paypalId: string = location.split('/').pop() || draft.id;

  if (!paypalId) throw new Error('PayPal create invoice succeeded but returned no invoice ID');

  // Guard: if all items were zero-price, the PayPal invoice total is 0 — abort early
  const paidItems = invoice.lineItems.filter(i => i.qty > 0 && i.unitPrice > 0);
  if (paidItems.length === 0) {
    throw new Error('PayPal invoice cannot be created: all line items have zero price');
  }

  // 2️⃣ Send the invoice — this activates the payment link
  const sendRes = await fetch(`${PAYPAL_API}/v2/invoicing/invoices/${paypalId}/send`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      Accept:         'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      send_to_recipient: true,   // PayPal sends their own email too (professional)
      send_to_invoicer:  false,
    }),
  });

  if (!sendRes.ok) {
    const err = await readPaypalError(sendRes);
    // Live PayPal has a hard restriction for recipients "within India" for invoices.
    // Sandbox often allows flows that are blocked in production.
    if (hasPaypalIssue(err, 'INR_FOREIGN_CURRENCY_BLOCKED')) {
      throw new Error(
        'PayPal limitation: cannot send PayPal invoices to customers within India in live mode. Use Razorpay or invoice a customer outside India.'
      );
    }
    throw new Error(`PayPal send invoice failed: ${JSON.stringify(err)}`);
  }

  // 3️⃣ Derive payer-view URL — construct from invoice ID (reliable across sandbox/live)
  // Fallback: fetch the invoice and look for the link in case PayPal changes the URL pattern
  const isSandbox = process.env.PAYPAL_ENV === 'sandbox';
  const paypalBase = isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
  let paymentUrl = `${paypalBase}/invoice/p/#${paypalId}`;

  try {
    const getRes = await fetch(`${PAYPAL_API}/v2/invoicing/invoices/${paypalId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const full = await getRes.json();
    const linked = (full.links as Array<{ rel: string; href: string }> | undefined)
      ?.find(l => l.rel === 'payer-view')?.href;
    if (linked) paymentUrl = linked;
  } catch {
    // constructed URL above is the fallback
  }

  return { id: paypalId, paymentUrl };
}

// ─── CREATE PayPal INSTALLMENT invoice ──────────────────────────
// Creates a single-item PayPal invoice for one instalment slice.
export async function createPaypalInstallmentInvoice(
  invoice: PaypalInvoiceInput,
  seq: number,
  total: number,
  dueDate: Date | string,
): Promise<PaypalInvoiceResult> {
  return createPaypalInvoice({
    ...invoice,
    id:            `${invoice.id}-inst${seq}`,  // unique idempotency key per instalment
    invoiceNumber: `${invoice.invoiceNumber}-${seq}`,
    dueDate,
    notes:         `Instalment ${seq} of your Career Booster Package.${invoice.notes ? ' ' + invoice.notes : ''}`,
    lineItems: [{
      description: `Instalment ${seq} — ${invoice.invoiceNumber}`,
      qty:         1,
      unitPrice:   total,
    }],
  });
}

// ─── CANCEL PayPal invoice ───────────────────────────────────────
export async function cancelPaypalInvoice(paypalInvoiceId: string): Promise<boolean> {
  try {
    const token = await getPaypalAccessToken();
    const res = await fetch(
      `${PAYPAL_API}/v2/invoicing/invoices/${paypalInvoiceId}/cancel`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          Accept:         'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ send_to_recipient: false }),
      }
    );
    // 204 = success, 422 = already cancelled/paid — both are acceptable
    return res.ok || res.status === 422;
  } catch {
    return false;
  }
}

// ─── FETCH PayPal invoice status ─────────────────────────────────
// Returns normalized status: 'PAID' | 'CANCELLED' | 'PENDING' | string
export async function fetchPaypalInvoiceStatus(paypalInvoiceId: string): Promise<{
  rawStatus: string;
  normalizedStatus: 'PAID' | 'CANCELLED' | 'EXPIRED' | null;
}> {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/invoicing/invoices/${paypalInvoiceId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch PayPal invoice status');

  const data      = await res.json();
  const rawStatus = (data.status as string)?.toUpperCase() ?? 'UNKNOWN';

  const normalizedStatus =
    ['PAID', 'MARKED_AS_PAID', 'PAYMENT_PENDING'].includes(rawStatus)      ? 'PAID'      :
    ['CANCELLED', 'REFUNDED', 'MARKED_AS_REFUNDED'].includes(rawStatus)    ? 'CANCELLED' :
    null;

  return { rawStatus, normalizedStatus };
}

// ─── VERIFY PayPal webhook signature ─────────────────────────────
// Uses PayPal's own verification endpoint (asymmetric — no shared secret)
export async function verifyPaypalWebhook(
  headers: Record<string, string | null>,
  rawBody: string
): Promise<boolean> {
  try {
    const token = await getPaypalAccessToken();
    const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id:   headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url:          headers['paypal-cert-url'],
        auth_algo:         headers['paypal-auth-algo'],
        transmission_sig:  headers['paypal-transmission-sig'],
        webhook_id:        PAYPAL_WEBHOOK_ID,
        webhook_event:     JSON.parse(rawBody),
      }),
    });
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}
