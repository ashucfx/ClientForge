// src/lib/email.ts

import type { InvoiceData, LineItem } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency, round2 } from './pricing';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL    = process.env.FROM_EMAIL ?? 'info@theripplenexus.com';
const FROM_NAME     = 'Ripple Nexus';
const REPLY_TO      = 'info@theripplenexus.com';
const WEBSITE       = 'https://www.theripplenexus.com';

// ─────────────────────────────────────────────
// LOGO SVG (inline, matches brand icon exactly)
// ─────────────────────────────────────────────
const LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ripple Nexus logo">
  <!-- Green peripheral dots -->
  <circle cx="50" cy="7"  r="6.5" fill="#5CC8A0"/>
  <circle cx="84" cy="19" r="6.5" fill="#5CC8A0"/>
  <circle cx="93" cy="54" r="6.5" fill="#5CC8A0"/>
  <circle cx="79" cy="88" r="6.5" fill="#5CC8A0"/>
  <circle cx="21" cy="88" r="6.5" fill="#5CC8A0"/>
  <circle cx="7"  cy="54" r="6.5" fill="#5CC8A0"/>
  <circle cx="16" cy="19" r="6.5" fill="#5CC8A0"/>
  <circle cx="50" cy="93" r="6.5" fill="#5CC8A0"/>
  <!-- Spoke lines (light blue) -->
  <line x1="50" y1="50" x2="50" y2="24"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="71" y2="29"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="76" y2="50"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="71" y2="71"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="50" y2="76"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="29" y2="71"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="24" y2="50"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <line x1="50" y1="50" x2="29" y2="29"  stroke="#7BA7F5" stroke-width="2.8" stroke-linecap="round"/>
  <!-- Blue spoke-end nodes -->
  <circle cx="50" cy="24" r="8.5" fill="#2B5CE6"/>
  <circle cx="71" cy="29" r="8.5" fill="#2B5CE6"/>
  <circle cx="76" cy="50" r="8.5" fill="#2B5CE6"/>
  <circle cx="71" cy="71" r="8.5" fill="#2B5CE6"/>
  <circle cx="50" cy="76" r="8.5" fill="#2B5CE6"/>
  <circle cx="29" cy="71" r="8.5" fill="#2B5CE6"/>
  <circle cx="24" cy="50" r="8.5" fill="#2B5CE6"/>
  <circle cx="29" cy="29" r="8.5" fill="#2B5CE6"/>
  <!-- Centre hub -->
  <circle cx="50" cy="50" r="17" fill="#2B5CE6"/>
</svg>`;

// ─────────────────────────────────────────────
// SEND INVOICE EMAIL
// ─────────────────────────────────────────────
export async function sendInvoiceEmail(
  invoice: InvoiceData,
  pdfBase64?: string
): Promise<void> {
  // Catchy, spam-safe subject
  const subject =
    `Invoice ${invoice.invoiceNumber}: Your Career Booster Package — Ripple Nexus`;

  const html = buildInvoiceEmailHTML(invoice);
  const text = buildInvoiceEmailText(invoice);

  const payload: Record<string, unknown> = {
    from:     `${FROM_NAME} <${FROM_EMAIL}>`,
    reply_to: REPLY_TO,
    to:       [invoice.clientEmail],
    subject,
    html,
    text,
    headers: {
      // RFC-2369 List-Unsubscribe — improves deliverability
      'List-Unsubscribe':       `<mailto:unsubscribe@theripplenexus.com?subject=unsubscribe>`,
      'List-Unsubscribe-Post':  'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID':        invoice.id,
    },
    tags: [
      { name: 'invoice_id',  value: invoice.id },
      { name: 'status',      value: invoice.status },
      { name: 'client_type', value: invoice.clientType },
    ],
  };

  if (pdfBase64) {
    payload.attachments = [
      {
        filename: `Invoice-${invoice.invoiceNumber}-RippleNexus.pdf`,
        content:  pdfBase64,
      },
    ];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Email send failed: ${JSON.stringify(err)}`);
  }
}

// ─────────────────────────────────────────────
// SEND PAYMENT CONFIRMATION EMAIL
// ─────────────────────────────────────────────
export async function sendPaymentConfirmationEmail(invoice: InvoiceData): Promise<void> {
  const html = buildConfirmationEmailHTML(invoice);
  const text = buildConfirmationEmailText(invoice);

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:     `${FROM_NAME} <${FROM_EMAIL}>`,
      reply_to: REPLY_TO,
      to:       [invoice.clientEmail],
      subject:  `Payment Received — ${invoice.invoiceNumber} | Your Career Boost is Underway`,
      html,
      text,
      headers: {
        'List-Unsubscribe':      `<mailto:unsubscribe@theripplenexus.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID':       invoice.id,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Confirmation email failed: ${JSON.stringify(err)}`);
  }
}

// ─────────────────────────────────────────────
// PLAIN-TEXT FALLBACK — INVOICE
// ─────────────────────────────────────────────
function buildInvoiceEmailText(invoice: InvoiceData): string {
  const sym = invoice.currencySymbol;
  const fmt = (n: number) => formatCurrency(n, sym);

  // Build line items from the new lineItems JSON array
  const items: LineItem[] = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems as unknown as LineItem[]
    : [];

  const itemLines = items.map(item => {
    const lt = item.qty * item.unitPrice;
    const priceStr = lt === 0 ? 'FREE' : fmt(lt);
    const qtyStr = item.qty !== 1 ? ` × ${item.qty}` : '';
    return `${item.description}${qtyStr}`.padEnd(35) + priceStr;
  }).join('\n');

  const discountLine = invoice.discountRate > 0
    ? `Discount (${invoice.discountRate}%)`.padEnd(35) + `-${fmt(invoice.discountAmount)}\n`
    : '';
  const taxLine = invoice.taxRate > 0
    ? `Tax (${invoice.taxRate}%)`.padEnd(35) + `+${fmt(invoice.taxAmount)}\n`
    : '';

  return `
Hi ${invoice.clientName.split(' ')[0]},

Your Career Booster Package invoice is ready.

Invoice Number : ${invoice.invoiceNumber}
Client         : ${invoice.clientName}
Package        : ${CLIENT_TYPE_LABELS[invoice.clientType]}
Invoice Date   : ${new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Due Date       : ${new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

─────────────────────────────────────
${itemLines}
─────────────────────────────────────
${'Subtotal'.padEnd(35)}${fmt(invoice.subtotalConverted)}
${discountLine}${taxLine}${'Processing Fee (' + (invoice.processingFeeRate * 100).toFixed(1) + '%)'.padEnd(35 - ('Processing Fee ('.length + (invoice.processingFeeRate * 100).toFixed(1).length))}${fmt(invoice.processingFeeConverted)}
─────────────────────────────────────
TOTAL PAYABLE                      ${fmt(invoice.totalPayable)} ${invoice.currency}
─────────────────────────────────────
${invoice.razorpayLinkUrl ? `PAY NOW: ${invoice.razorpayLinkUrl}` : ''}

Terms: No refunds after work commences. Delivery within 2–4 business days. 2 revisions included.

Questions? Reply to this email or write to ${REPLY_TO}

Ripple Nexus | ${WEBSITE}
To unsubscribe, email unsubscribe@theripplenexus.com
`.trim();
}

// ─────────────────────────────────────────────
// PLAIN-TEXT FALLBACK — CONFIRMATION
// ─────────────────────────────────────────────
function buildConfirmationEmailText(invoice: InvoiceData): string {
  const sym = invoice.currencySymbol;
  const fmt = (n: number) => formatCurrency(n, sym);
  return `
Hi ${invoice.clientName.split(' ')[0]},

Great news — your payment has been received!

Invoice   : ${invoice.invoiceNumber}
Amount    : ${fmt(invoice.totalPayable)} ${invoice.currency}
Package   : ${CLIENT_TYPE_LABELS[invoice.clientType]}
Paid On   : ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}

Our team will begin your Career Booster Package within 24 hours.
Expected delivery: 2-4 business days.

Questions? Write to ${REPLY_TO}

Ripple Nexus | ${WEBSITE}
`.trim();
}

// ─────────────────────────────────────────────
// EMAIL HTML TEMPLATE — INVOICE
// ─────────────────────────────────────────────
function buildInvoiceEmailHTML(invoice: InvoiceData): string {
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDateStr     = new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const payBtnHTML = invoice.razorpayLinkUrl
    ? `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${invoice.razorpayLinkUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="15%"
          stroke="f" fillcolor="#2B5CE6">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Helvetica,sans-serif;font-size:17px;font-weight:700;">
            Pay Now &mdash; ${fmt(invoice.totalPayable)}
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${invoice.razorpayLinkUrl}"
           target="_blank"
           style="display:inline-block;background:linear-gradient(135deg,#2B5CE6 0%,#1a42a0 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:800;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(43,92,230,0.45);mso-hide:all;">
          Pay Now &mdash; ${fmt(invoice.totalPayable)}
        </a>
        <!--<![endif]-->`
    : '';

  // Build line item rows from the new lineItems JSON array
  const lineItemsArr: LineItem[] = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems as unknown as LineItem[]
    : [];

  const lineItemRows = lineItemsArr.map((item, idx) => {
    const lt = round2(item.qty * item.unitPrice);
    const isFree = lt === 0;
    const isLast = idx === lineItemsArr.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom:1px solid #eef2ff;';
    // Icon: pick based on common keywords, fallback to document icon
    const icon = /resume|cv/i.test(item.description) ? '&#128196;'
      : /linkedin/i.test(item.description) ? '&#128279;'
      : /cover/i.test(item.description) ? '&#9993;'
      : '&#128203;';
    const iconBg = isFree ? '#f0fdf4' : '#eef2ff';
    return `<tr>
        <td style="padding:12px 16px;${borderStyle}">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td width="30" valign="middle">
                <div style="width:26px;height:26px;background:${iconBg};border-radius:50%;text-align:center;line-height:26px;font-size:13px;">${icon}</div>
              </td>
              <td style="padding-left:10px;" valign="middle">
                <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0f1c3d;font-weight:600;">${item.description}</div>
                ${item.qty !== 1 ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;margin-top:1px;">Qty: ${item.qty} &times; ${fmt(item.unitPrice)}</div>` : ''}
              </td>
              <td align="right" valign="middle" style="white-space:nowrap;">
                ${isFree
                  ? `<span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#16a34a;font-weight:700;background:#f0fdf4;padding:3px 10px;border-radius:20px;border:1px solid #bbf7d0;">FREE</span>`
                  : `<span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#0f1c3d;font-weight:700;">${fmt(lt)}</span>`
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  // Totals rows
  const discountRow = invoice.discountRate > 0 ? `
          <tr>
            <td style="padding:4px 16px;background:#fafbff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#16a34a;">Discount (${invoice.discountRate}%)</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#16a34a;">&#8722;${fmt(invoice.discountAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  const taxRow = invoice.taxRate > 0 ? `
          <tr>
            <td style="padding:4px 16px;background:#fafbff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">Tax (${invoice.taxRate}%)</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">+${fmt(invoice.taxAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no"/>
  <title>Invoice ${invoice.invoiceNumber} — Ripple Nexus</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    /* Mobile */
    @media only screen and (max-width:640px) {
      .email-container { width:100% !important; }
      .mobile-pad      { padding:20px 16px !important; }
      .mobile-center   { text-align:center !important; }
      .mobile-hide     { display:none !important; }
      .mobile-full     { width:100% !important; display:block !important; }
      .hero-title      { font-size:24px !important; }
      .btn-pay         { padding:14px 24px !important; font-size:15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;word-break:break-word;">

<!-- Preheader (inbox preview text — hidden in body) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#eef2ff;line-height:1px;max-width:0;">
  Hi ${firstName}, your ${CLIENT_TYPE_LABELS[invoice.clientType]} invoice for ${fmt(invoice.totalPayable)} is ready — complete payment to kick off your career transformation.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef2ff">
<tr><td align="center" style="padding:28px 12px;">

  <!-- Email Card -->
  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(43,92,230,0.10);">

    <!-- ══════════════════ HEADER ══════════════════ -->
    <tr>
      <td style="background:linear-gradient(135deg,#1a3fa8 0%,#2B5CE6 55%,#1d4ed8 100%);padding:28px 36px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Logo + Brand -->
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    ${LOGO_SVG}
                  </td>
                  <td valign="middle">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1;">
                      Ripple<span style="color:#5CC8A0;">Nexus</span>
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.65);letter-spacing:1.2px;text-transform:uppercase;margin-top:3px;">
                      Career Acceleration
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <!-- Invoice Badge -->
            <td align="right" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="background:rgba(255,255,255,0.12);border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <tr>
                  <td style="padding:10px 18px;text-align:right;">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;">Invoice</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;margin-top:2px;letter-spacing:0.3px;">${invoice.invoiceNumber}</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.55);margin-top:3px;">${invoiceDateStr}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ ACCENT BAR ══════════════════ -->
    <tr>
      <td height="4" style="background:linear-gradient(90deg,#5CC8A0 0%,#2B5CE6 50%,#5CC8A0 100%);font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- ══════════════════ GREETING ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:32px 36px 0;">
        <h1 class="hero-title"
            style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:26px;color:#0d1b4b;font-weight:800;line-height:1.3;">
          Hello, ${firstName}! &#127775;
        </h1>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#4a5568;line-height:1.75;">
          Your <strong style="color:#2B5CE6;">${CLIENT_TYPE_LABELS[invoice.clientType]}</strong> Career Booster Package invoice is attached and ready.
          Review the details below, then click <strong>Pay Now</strong> to unlock your transformation.
        </p>
      </td>
    </tr>

    <!-- ══════════════════ CLIENT / INVOICE META ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f5f8ff;border-radius:12px;border:1px solid #dce6ff;overflow:hidden;">
          <tr>
            <td width="50%" style="padding:14px 18px;border-right:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Billed To</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:700;margin-top:4px;">${invoice.clientName}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${invoice.clientEmail}</div>
            </td>
            <td width="50%" style="padding:14px 18px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Package</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#2B5CE6;font-weight:700;margin-top:4px;">${CLIENT_TYPE_LABELS[invoice.clientType]}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${invoice.country}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;border-top:1px solid #dce6ff;border-right:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Issue Date</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;margin-top:4px;">${invoiceDateStr}</div>
            </td>
            <td style="padding:12px 18px;border-top:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Due Date</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#dc2626;font-weight:700;margin-top:4px;">${dueDateStr}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ SERVICES BREAKDOWN ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:24px 36px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#7c8db5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">
          Services Included
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border-radius:12px;border:1px solid #dce6ff;overflow:hidden;">
          <!-- Line items (dynamic from invoice.lineItems) -->
          ${lineItemRows}
          <!-- Divider row -->
          <tr><td style="height:1px;background:#dce6ff;font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Subtotal -->
          <tr>
            <td style="padding:10px 16px 4px;background:#fafbff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">Subtotal</td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">${fmt(invoice.subtotalConverted)}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${discountRow}
          ${taxRow}
          <tr>
            <td style="padding:4px 16px 10px;background:#fafbff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">
                    Processing Fee (${(invoice.processingFeeRate * 100).toFixed(1)}%)
                  </td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;">${fmt(invoice.processingFeeConverted)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ TOTAL BANNER ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:14px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(135deg,#1a3fa8 0%,#2B5CE6 100%);border-radius:12px;">
          <tr>
            <td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">Total Payable</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${invoice.currency} &bull; incl. all fees</div>
                  </td>
                  <td align="right">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${fmt(invoice.totalPayable)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ PAY NOW CTA ══════════════════ -->
    ${invoice.razorpayLinkUrl ? `
    <tr>
      <td class="mobile-pad" style="padding:28px 36px 8px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="border-radius:8px;"
                bgcolor="#2B5CE6">
              ${payBtnHTML}
            </td>
          </tr>
        </table>
        <div style="margin-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
          Secure payment via Razorpay &nbsp;&#128274;&nbsp; UPI &bull; Cards &bull; Net Banking &bull; Wallets
        </div>
        <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#b0b8cc;">
          Or paste this link in your browser:<br/>
          <a href="${invoice.razorpayLinkUrl}" style="color:#2B5CE6;word-break:break-all;">${invoice.razorpayLinkUrl}</a>
        </div>
      </td>
    </tr>` : ''}

    <!-- ══════════════════ DELIVERY TIMELINE ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:24px 36px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#7c8db5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">
          What Happens Next
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Step 1 -->
            <td width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:#eef2ff;border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:16px;">&#9989;</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Payment</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">Instant</div>
            </td>
            <!-- Arrow -->
            <td width="8%" align="center" valign="top" style="padding-top:10px;font-size:18px;color:#c7d2fe;">&rarr;</td>
            <!-- Step 2 -->
            <td width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:#eef2ff;border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:16px;">&#128203;</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Kickoff</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">Within 24 hrs</div>
            </td>
            <!-- Arrow -->
            <td width="8%" align="center" valign="top" style="padding-top:10px;font-size:18px;color:#c7d2fe;">&rarr;</td>
            <!-- Step 3 -->
            <td width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:#eef2ff;border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:16px;">&#127775;</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Delivery</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">2–4 business days</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ TESTIMONIAL / VALUE PROP ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border-left:4px solid #5CC8A0;background:#f0fdf9;border-radius:0 10px 10px 0;padding:0;">
          <tr>
            <td style="padding:16px 20px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#065f46;line-height:1.7;font-style:italic;">
                &#8220;A strategic investment in your career trajectory — crafted to maximise recruiter visibility,
                increase interview conversion, and give you the competitive edge you deserve.&#8221;
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#5CC8A0;font-weight:700;margin-top:8px;letter-spacing:0.5px;">
                &mdash; THE RIPPLE NEXUS TEAM
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ TRUST BADGES ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:20px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <span style="font-size:18px;display:block;margin-bottom:4px;">&#128274;</span>
                <strong style="color:#0d1b4b;">Secure Payment</strong><br/>256-bit SSL
              </div>
            </td>
            <td width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <span style="font-size:18px;display:block;margin-bottom:4px;">&#128336;</span>
                <strong style="color:#0d1b4b;">Fast Delivery</strong><br/>2–4 Business Days
              </div>
            </td>
            <td width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <span style="font-size:18px;display:block;margin-bottom:4px;">&#128100;</span>
                <strong style="color:#0d1b4b;">2 Revisions</strong><br/>Satisfaction Driven
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ TERMS ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:20px 36px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9ca3af;line-height:1.9;border-top:1px solid #eef2ff;padding-top:16px;">
          <strong style="color:#6b7280;">Terms &amp; Conditions:</strong>&nbsp;
          No refunds after work commences &bull; Delivery within 2–4 business days &bull;
          2 revisions included; additional revisions chargeable &bull;
          No job placement guarantee &bull; All data kept strictly confidential.
        </div>
      </td>
    </tr>

    <!-- ══════════════════ FOOTER ══════════════════ -->
    <tr>
      <td style="background:#f5f8ff;padding:22px 36px;border-top:1px solid #dce6ff;border-radius:0 0 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Brand -->
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <svg width="22" height="22" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="7"  r="6.5" fill="#5CC8A0"/><circle cx="84" cy="19" r="6.5" fill="#5CC8A0"/>
                      <circle cx="93" cy="54" r="6.5" fill="#5CC8A0"/><circle cx="7"  cy="54" r="6.5" fill="#5CC8A0"/>
                      <line x1="50" y1="50" x2="50" y2="24" stroke="#7BA7F5" stroke-width="3"/>
                      <line x1="50" y1="50" x2="71" y2="29" stroke="#7BA7F5" stroke-width="3"/>
                      <line x1="50" y1="50" x2="76" y2="50" stroke="#7BA7F5" stroke-width="3"/>
                      <line x1="50" y1="50" x2="24" y2="50" stroke="#7BA7F5" stroke-width="3"/>
                      <circle cx="50" cy="24" r="8" fill="#2B5CE6"/><circle cx="71" cy="29" r="8" fill="#2B5CE6"/>
                      <circle cx="76" cy="50" r="8" fill="#2B5CE6"/><circle cx="24" cy="50" r="8" fill="#2B5CE6"/>
                      <circle cx="50" cy="50" r="15" fill="#2B5CE6"/>
                    </svg>
                  </td>
                  <td valign="middle">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#2B5CE6;line-height:1;">
                      Ripple<span style="color:#5CC8A0;">Nexus</span>
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;margin-top:3px;">
                      <a href="mailto:${REPLY_TO}" style="color:#9ca3af;text-decoration:none;">${REPLY_TO}</a>
                      &nbsp;&bull;&nbsp;
                      <a href="${WEBSITE}" style="color:#9ca3af;text-decoration:none;">theripplenexus.com</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <!-- Invoice ref -->
            <td align="right" valign="middle">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#b0b8cc;">
                Ref: ${invoice.invoiceNumber}
              </div>
            </td>
          </tr>
          <!-- Legal line -->
          <tr>
            <td colspan="2" style="padding-top:12px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#c4c9d8;line-height:1.6;text-align:center;border-top:1px solid #e8eeff;padding-top:10px;">
                You received this email because you requested a Career Booster Package from Ripple Nexus.
                &nbsp;|&nbsp;
                <a href="mailto:unsubscribe@theripplenexus.com?subject=unsubscribe" style="color:#c4c9d8;">Unsubscribe</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
  <!-- /Email Card -->

</td></tr>
</table>
<!-- /Wrapper -->

</body>
</html>`;
}

// ─────────────────────────────────────────────
// EMAIL HTML TEMPLATE — PAYMENT CONFIRMATION
// ─────────────────────────────────────────────
function buildConfirmationEmailHTML(invoice: InvoiceData): string {
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const paidOnStr = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Payment Confirmed — Ripple Nexus</title>
  <style>
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    @media only screen and (max-width:640px) {
      .email-container { width:100% !important; }
      .mobile-pad      { padding:20px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#eef2ff;line-height:1px;max-width:0;">
  Payment received! Your Career Booster Package is now active. Work begins within 24 hours.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef2ff">
<tr><td align="center" style="padding:28px 12px;">

  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(92,200,160,0.12);">

    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#0d9466 0%,#5CC8A0 100%);padding:40px 36px;text-align:center;">
        <!-- Logo -->
        <div style="margin-bottom:16px;">
          <svg width="52" height="52" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
            <circle cx="50" cy="7"  r="6.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="84" cy="19" r="6.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="93" cy="54" r="6.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="79" cy="88" r="6.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="21" cy="88" r="6.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="7"  cy="54" r="6.5" fill="rgba(255,255,255,0.5)"/>
            <line x1="50" y1="50" x2="50" y2="24" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="71" y2="29" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="76" y2="50" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="71" y2="71" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="50" y2="76" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="29" y2="71" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <line x1="50" y1="50" x2="24" y2="50" stroke="rgba(255,255,255,0.4)" stroke-width="2.8"/>
            <circle cx="50" cy="24" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="71" cy="29" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="76" cy="50" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="71" cy="71" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="50" cy="76" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="29" cy="71" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="24" cy="50" r="8.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="50" cy="50" r="17" fill="rgba(255,255,255,0.9)"/>
            <!-- Check mark in center -->
            <text x="50" y="56" text-anchor="middle" font-size="18" font-family="Arial" fill="#0d9466">&#10003;</text>
          </svg>
        </div>
        <h1 style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">
          Payment Confirmed!
        </h1>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.88);line-height:1.6;">
          Thank you, <strong>${firstName}</strong>. Your Career Booster Package is now active<br/>and our team is ready to get to work.
        </p>
      </td>
    </tr>

    <!-- Accent bar -->
    <tr>
      <td height="4" style="background:linear-gradient(90deg,#2B5CE6 0%,#5CC8A0 50%,#2B5CE6 100%);font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Payment Summary -->
    <tr>
      <td class="mobile-pad" style="padding:32px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f5f8ff;border-radius:12px;border:1px solid #dce6ff;overflow:hidden;">
          <tr>
            <td width="50%" style="padding:14px 18px;border-right:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Invoice</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:700;margin-top:4px;">${invoice.invoiceNumber}</div>
            </td>
            <td width="50%" style="padding:14px 18px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Amount Paid</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#0d9466;font-weight:800;margin-top:4px;">${fmt(invoice.totalPayable)} ${invoice.currency}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;border-top:1px solid #dce6ff;border-right:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Package</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#2B5CE6;font-weight:600;margin-top:4px;">${CLIENT_TYPE_LABELS[invoice.clientType]}</div>
            </td>
            <td style="padding:12px 18px;border-top:1px solid #dce6ff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Paid On</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;margin-top:4px;">${paidOnStr}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- What's next -->
    <tr>
      <td class="mobile-pad" style="padding:24px 36px 0;">
        <p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#0d1b4b;font-weight:700;">
          Here's what happens next:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top" width="28" style="padding-top:2px;">
              <div style="width:22px;height:22px;background:#eef2ff;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:#2B5CE6;">1</div>
            </td>
            <td style="padding:0 0 12px 10px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;">Our team begins work within 24 hours</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:2px;">We'll review your profile and start crafting your materials.</div>
            </td>
          </tr>
          <tr>
            <td valign="top" width="28" style="padding-top:2px;">
              <div style="width:22px;height:22px;background:#eef2ff;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:#2B5CE6;">2</div>
            </td>
            <td style="padding:0 0 12px 10px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;">Delivery within 2–4 business days</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:2px;">You'll receive your polished career documents via email.</div>
            </td>
          </tr>
          <tr>
            <td valign="top" width="28" style="padding-top:2px;">
              <div style="width:22px;height:22px;background:#eef2ff;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:#2B5CE6;">3</div>
            </td>
            <td style="padding:0 0 0 10px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;">2 rounds of revisions included</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:2px;">We'll refine until you're completely satisfied.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Contact -->
    <tr>
      <td class="mobile-pad" style="padding:20px 36px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f0fdf9;border-left:4px solid #5CC8A0;border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#065f46;line-height:1.7;">
                Questions or need to share additional information?
                Reply directly to this email or reach us at&nbsp;
                <a href="mailto:${REPLY_TO}" style="color:#0d9466;font-weight:600;">${REPLY_TO}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#f5f8ff;padding:20px 36px;border-top:1px solid #dce6ff;border-radius:0 0 16px 16px;text-align:center;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#2B5CE6;margin-bottom:4px;">
          Ripple<span style="color:#5CC8A0;">Nexus</span>
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;">
          <a href="${WEBSITE}" style="color:#9ca3af;text-decoration:none;">theripplenexus.com</a>
          &nbsp;&bull;&nbsp;
          <a href="mailto:unsubscribe@theripplenexus.com?subject=unsubscribe" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
        </div>
      </td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`;
}
