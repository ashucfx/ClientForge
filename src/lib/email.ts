// src/lib/email.ts

import type { InvoiceData, LineItem } from '@/types';
import { BRAND_EMAIL, BRAND_WEBSITE_LABEL, BRAND_WEBSITE_URL } from './config';
import { CLIENT_TYPE_LABELS, formatCurrency, round2 } from './pricing';

import { getBrand } from './brand/registry';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

// ─────────────────────────────────────────────
// PACKAGE LABEL — derived from line items
// Only say "Career Booster Package" when all three core services are present.
// ─────────────────────────────────────────────
export function derivePackageLabel(lineItems: LineItem[]): string {
  const descs = lineItems.map(i => i.description.toLowerCase());
  const hasResume      = descs.some(d => /resume|cv\b/i.test(d));
  const hasLinkedin    = descs.some(d => /linkedin/i.test(d));
  const hasCoverLetter = descs.some(d => /cover.?letter/i.test(d));

  if (hasResume && hasLinkedin && hasCoverLetter) return 'Career Booster Package';

  const parts: string[] = [];
  if (hasResume)      parts.push('Resume Rewrite');
  if (hasLinkedin)    parts.push('LinkedIn Profile Optimisation');
  if (hasCoverLetter) parts.push('Cover Letter');
  return parts.length > 0 ? parts.join(' + ') : 'Career Services';
}

// ─────────────────────────────────────────────
// SEND INVOICE EMAIL
// ─────────────────────────────────────────────
export async function sendInvoiceEmail(
  invoice: InvoiceData,
  pdfBase64?: string
): Promise<void> {
  const brand = getBrand(invoice.brandId);

  // Catchy, spam-safe subject
  const subject =
    `Invoice ${invoice.invoiceNumber}: Your ${brand.id === 'catalyst' ? 'Career Booster Package' : 'Service'} — ${brand.name}`;

  const html = buildInvoiceEmailHTML(invoice);
  const text = buildInvoiceEmailText(invoice);

  const payload: Record<string, unknown> = {
    from:     `${brand.name} <${brand.fromEmail}>`,
    reply_to: brand.replyTo,
    to:       [invoice.clientEmail],
    subject,
    html,
    text,
    headers: {
      // RFC-2369 List-Unsubscribe — improves deliverability
      'List-Unsubscribe':       `<mailto:${brand.replyTo}?subject=unsubscribe>`,
      'List-Unsubscribe-Post':  'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID':        invoice.id,
    },
    tags: [
      { name: 'invoice_id',  value: invoice.id },
      { name: 'status',      value: invoice.status },
      { name: 'client_type', value: invoice.clientType },
      { name: 'brand',       value: brand.id },
    ],
  };

  if (pdfBase64) {
    payload.attachments = [
      {
        filename: `Invoice-${invoice.invoiceNumber}-${brand.name}.pdf`,
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
  const brand = getBrand(invoice.brandId);
  const html = buildConfirmationEmailHTML(invoice);
  const text = buildConfirmationEmailText(invoice);

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:     `${brand.name} <${brand.fromEmail}>`,
      reply_to: brand.replyTo,
      to:       [invoice.clientEmail],
      subject:  `Payment Received — ${invoice.invoiceNumber} | ${brand.id === 'catalyst' ? 'Your Career Boost is Underway' : 'Project Kickoff Initiated'}`,
      html,
      text,
      headers: {
        'List-Unsubscribe':      `<mailto:${brand.replyTo}?subject=unsubscribe>`,
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
  const brand = getBrand(invoice.brandId);
  const sym = invoice.currencySymbol;
  const fmt = (n: number) => formatCurrency(n, sym);

  const items: LineItem[] = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems as unknown as LineItem[]
    : [];
  const packageLabel = derivePackageLabel(items);

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

Your ${brand.id === 'catalyst' ? 'Career Booster Package ' : ''}invoice is ready.

Invoice Number : ${invoice.invoiceNumber}
Client         : ${invoice.clientName}
Package        : ${packageLabel}
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
${invoice.razorpayLinkUrl ? `PAY NOW: ${invoice.razorpayLinkUrl}` : invoice.paypalPaymentUrl ? `PAY NOW: ${invoice.paypalPaymentUrl}` : ''}

Terms: No refunds after work commences. Delivery within 2–4 business days. 2 revisions included.

Questions? Reply to this email or write to ${brand.replyTo}

${brand.name} | ${brand.websiteUrl}
To unsubscribe, email ${brand.replyTo}
`.trim();
}

// ─────────────────────────────────────────────
// PLAIN-TEXT FALLBACK — CONFIRMATION
// ─────────────────────────────────────────────
function buildConfirmationEmailText(invoice: InvoiceData): string {
  const brand = getBrand(invoice.brandId);
  const sym = invoice.currencySymbol;
  const fmt = (n: number) => formatCurrency(n, sym);
  const items: LineItem[] = Array.isArray(invoice.lineItems) ? invoice.lineItems as unknown as LineItem[] : [];
  const packageLabel = derivePackageLabel(items);
  return `
Hi ${invoice.clientName.split(' ')[0]},

Great news — your payment has been received!

Invoice   : ${invoice.invoiceNumber}
Amount    : ${fmt(invoice.totalPayable)} ${invoice.currency}
Package   : ${packageLabel}
Paid On   : ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}

Our team will begin your ${brand.id === 'catalyst' ? 'Career Booster Package' : 'project'} within 24 hours.
Expected delivery: 2-4 business days.

Questions? Write to ${brand.replyTo}

${brand.name} | ${brand.websiteUrl}
To unsubscribe, email ${brand.replyTo}
`.trim();
}

// ─────────────────────────────────────────────
// EMAIL HTML TEMPLATE — INVOICE
// ─────────────────────────────────────────────
function buildInvoiceEmailHTML(invoice: InvoiceData): string {
  const brand     = getBrand(invoice.brandId);
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDateStr     = new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const lineItemsArr: LineItem[] = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems as unknown as LineItem[]
    : [];
  const packageLabel = derivePackageLabel(lineItemsArr);

  const payUrl = invoice.razorpayLinkUrl || invoice.paypalPaymentUrl || '';
  const isPayPal = !invoice.razorpayLinkUrl && !!invoice.paypalPaymentUrl;
  const payBtnHTML = payUrl
    ? `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${payUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="15%"
          stroke="f" fillcolor="${brand.primaryColor}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Helvetica,sans-serif;font-size:17px;font-weight:700;">
            Pay Now &mdash; ${fmt(invoice.totalPayable)}
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${payUrl}"
           target="_blank"
           style="display:inline-block;background:linear-gradient(135deg,${brand.primaryColor} 0%,${brand.primaryDark} 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:800;letter-spacing:0.3px;box-shadow:0 4px 16px ${brand.primaryLight};mso-hide:all;">
          Pay Now &mdash; ${fmt(invoice.totalPayable)}
        </a>
        <!--<![endif]-->`
    : '';

  // Line items already extracted above (lineItemsArr)

  const lineItemRows = lineItemsArr.map((item, idx) => {
    const lt = round2(item.qty * item.unitPrice);
    const isFree = lt === 0;
    const isLast = idx === lineItemsArr.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom:1px solid #EDE9DF;';
    const iconBg = isFree ? '#f0fdf4' : (brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg);
    const iconColor = isFree ? '#16a34a' : brand.primaryColor;
    const iconNum = String(idx + 1);
    return `<tr>
        <td style="padding:12px 16px;${borderStyle}">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td width="30" valign="middle">
                <div style="width:26px;height:26px;background:${iconBg};border-radius:50%;text-align:center;line-height:26px;font-size:11px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:${iconColor};">${iconNum}</div>
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
            <td style="padding:4px 16px;background:#FAFAF8;">
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
            <td style="padding:4px 16px;background:#FAFAF8;">
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
  <title>Invoice ${invoice.invoiceNumber} — ${brand.name}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    /* Mobile */
    @media only screen and (max-width:600px) {
      .email-container  { width:100% !important; }
      .mobile-pad       { padding:18px 14px !important; }
      .mobile-center    { text-align:center !important; }
      .mobile-hide      { display:none !important; }
      .mobile-full      { width:100% !important; display:block !important; }
      .hero-title       { font-size:22px !important; }
      .btn-pay          { padding:14px 20px !important; font-size:15px !important; display:block !important; text-align:center !important; }
      /* Header: hide invoice badge on small screens, let brand breathe */
      .hdr-badge        { display:none !important; }
      /* Meta grid: stack 50/50 cells full-width */
      .meta-cell        { display:block !important; width:100% !important; box-sizing:border-box !important; border-right:none !important; border-bottom:1px solid #EDE9DF !important; }
      /* Timeline: hide arrows, let steps wrap */
      .tl-arrow         { display:none !important; }
      .tl-step          { display:inline-block !important; width:30% !important; }
      /* Trust badges: keep 3-up but smaller */
      .badge-cell       { padding:0 2px !important; }
      /* Total amount font size */
      .total-amount     { font-size:22px !important; }
      /* Footer: stack brand & ref */
      .footer-ref       { display:none !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background-color:${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg};word-break:break-word;">

<!-- Preheader (inbox preview text — hidden in body) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg};line-height:1px;max-width:0;">
  Hi ${firstName}, your ${packageLabel} invoice for ${fmt(invoice.totalPayable)} is ready.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg}">
<tr><td align="center" style="padding:28px 12px;">

  <!-- Email Card -->
  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,11,13,0.12);">

    <!-- ══════════════════ HEADER ══════════════════ -->
    <tr>
      <td style="background:${brand.gradient};padding:28px 36px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Logo + Brand -->
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;width:44px;">
                    ${brand.logoEmailHtml(44)}
                  </td>
                  <td valign="middle" style="white-space:nowrap;">
                    <div style="font-family:${brand.fontSerif};font-size:18px;font-weight:400;color:${brand.id === 'catalyst' ? '#F4F1EB' : '#F4F5FA'};letter-spacing:2px;line-height:1;white-space:nowrap;">
                      ${brand.name.toUpperCase()}
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;color:${brand.id === 'catalyst' ? 'rgba(184,147,91,0.80)' : 'rgba(34,211,238,0.80)'};letter-spacing:1.8px;text-transform:uppercase;margin-top:4px;white-space:nowrap;">
                      ${brand.tagline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <!-- Invoice Badge -->
            <td class="hdr-badge" align="right" valign="middle">
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
      <td height="3" style="background:${brand.accentBar};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- ══════════════════ GREETING ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:32px 36px 0;">
        <h1 class="hero-title"
            style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:26px;color:#0d1b4b;font-weight:800;line-height:1.3;">
          Hello, ${firstName},
        </h1>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#4a5568;line-height:1.75;">
          Your <strong style="color:${brand.primaryColor};">${packageLabel}</strong> invoice is ready.
          Review the details below, then click <strong>Pay Now</strong>.
        </p>
      </td>
    </tr>

    <!-- ══════════════════ CLIENT / INVOICE META ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#F5F3EE;border-radius:12px;border:1px solid #EDE9DF;overflow:hidden;">
          <tr>
            <td class="meta-cell" width="50%" style="padding:14px 18px;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Billed To</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:700;margin-top:4px;">${invoice.clientName}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${invoice.clientEmail}</div>
            </td>
            <td class="meta-cell" width="50%" style="padding:14px 18px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Package</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${brand.primaryColor};font-weight:700;margin-top:4px;">${packageLabel}</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">${invoice.country}</div>
            </td>
          </tr>
          <tr>
            <td class="meta-cell" style="padding:12px 18px;border-top:1px solid #EDE9DF;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Issue Date</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;margin-top:4px;">${invoiceDateStr}</div>
            </td>
            <td class="meta-cell" style="padding:12px 18px;border-top:1px solid #EDE9DF;">
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
               style="border-radius:12px;border:1px solid #EDE9DF;overflow:hidden;">
          <!-- Line items (dynamic from invoice.lineItems) -->
          ${lineItemRows}
          <!-- Divider row -->
          <tr><td style="height:1px;background:#EDE9DF;font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Subtotal -->
          <tr>
            <td style="padding:10px 16px 4px;background:#FAFAF8;">
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
            <td style="padding:4px 16px 10px;background:#FAFAF8;">
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
               style="background:linear-gradient(135deg,#0A0B0D 0%,${brand.primaryColor} 100%);border-radius:12px;">
          <tr>
            <td style="padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">Total Payable</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${invoice.currency} &bull; incl. all fees</div>
                  </td>
                  <td align="right">
                    <div class="total-amount" style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${fmt(invoice.totalPayable)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ PAY NOW CTA ══════════════════ -->
    ${payUrl ? `
    <tr>
      <td class="mobile-pad" style="padding:28px 36px 8px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:320px;">
          <tr>
            <td align="center" style="border-radius:8px;" bgcolor="${brand.primaryColor}">
              ${payBtnHTML}
            </td>
          </tr>
        </table>
        <div style="margin-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
          ${isPayPal
            ? 'Secure payment via PayPal &mdash; Cards &bull; PayPal Balance &bull; Bank Transfer'
            : 'Secure payment via Razorpay &mdash; UPI &bull; Cards &bull; Net Banking &bull; Wallets'}
        </div>
        <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#b0b8cc;">
          Or paste this link in your browser:<br/>
          <a href="${payUrl}" style="color:${brand.primaryColor};word-break:break-all;">${payUrl}</a>
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
            <td class="tl-step" width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:15px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">1</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Payment</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">Instant</div>
            </td>
            <!-- Arrow -->
            <td class="tl-arrow" width="8%" align="center" valign="top" style="padding-top:10px;font-size:18px;color:#c7d2fe;">&rarr;</td>
            <!-- Step 2 -->
            <td class="tl-step" width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:15px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">2</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Kickoff</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">Within 24 hrs</div>
            </td>
            <!-- Arrow -->
            <td class="tl-arrow" width="8%" align="center" valign="top" style="padding-top:10px;font-size:18px;color:#c7d2fe;">&rarr;</td>
            <!-- Step 3 -->
            <td class="tl-step" width="25%" align="center" valign="top" style="padding:0 6px;">
              <div style="width:36px;height:36px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 8px;text-align:center;line-height:36px;font-size:15px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">3</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#0d1b4b;text-align:center;">Delivery</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;text-align:center;margin-top:2px;">2–4 business days</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══════════════════ TESTIMONIAL / VALUE PROP ══════════════════ -->
    ${brand.id === 'catalyst' ? `
    <tr>
      <td class="mobile-pad" style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border-left:4px solid #10B981;background:#f0fdf9;border-radius:0 10px 10px 0;padding:0;">
          <tr>
            <td style="padding:16px 20px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#065f46;line-height:1.7;font-style:italic;">
                &#8220;A strategic investment in your career trajectory — crafted to maximise recruiter visibility,
                increase interview conversion, and give you the competitive edge you deserve.&#8221;
              </div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#10B981;font-weight:700;margin-top:8px;letter-spacing:0.5px;">
                &mdash; THE CATALYST TEAM
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}

    <!-- ══════════════════ TRUST BADGES ══════════════════ -->
    <tr>
      <td class="mobile-pad" style="padding:20px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td class="badge-cell" width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <div style="width:32px;height:32px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 6px;text-align:center;line-height:32px;font-size:11px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">SSL</div>
                <strong style="color:#0d1b4b;">Secure Payment</strong><br/>256-bit SSL
              </div>
            </td>
            <td class="badge-cell" width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <div style="width:32px;height:32px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 6px;text-align:center;line-height:32px;font-size:11px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">2-4</div>
                <strong style="color:#0d1b4b;">Fast Delivery</strong><br/>2–4 Business Days
              </div>
            </td>
            <td class="badge-cell" width="33%" align="center" style="padding:0 4px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;text-align:center;">
                <div style="width:32px;height:32px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;margin:0 auto 6px;text-align:center;line-height:32px;font-size:11px;font-weight:800;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">x2</div>
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
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9ca3af;line-height:1.9;border-top:1px solid #EDE9DF;padding-top:16px;">
          <strong style="color:#6b7280;">Terms &amp; Conditions:</strong>&nbsp;
          No refunds after work commences &bull; Delivery within 2–4 business days &bull;
          2 revisions included; additional revisions chargeable &bull;
          No job placement guarantee &bull; All data kept strictly confidential.
        </div>
      </td>
    </tr>

    <!-- ══════════════════ FOOTER ══════════════════ -->
    <tr>
      <td style="background:#F5F3EE;padding:22px 36px;border-top:1px solid #EDE9DF;border-radius:0 0 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Brand -->
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    ${brand.logoEmailHtml(22)}
                  </td>
                  <td valign="middle">
                    <div style="font-family:${brand.fontSerif};font-size:13px;font-weight:400;color:${brand.primaryColor};letter-spacing:2px;line-height:1;white-space:nowrap;">
                      ${brand.name.toUpperCase()}
                    </div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;margin-top:3px;">
                      <a href="mailto:${brand.replyTo}" style="color:#9ca3af;text-decoration:none;">${brand.replyTo}</a>
                      &nbsp;&bull;&nbsp;
                      <a href="${brand.websiteUrl}" style="color:#9ca3af;text-decoration:none;">${brand.websiteLabel}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <!-- Invoice ref -->
            <td class="footer-ref" align="right" valign="middle">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#b0b8cc;">
                Ref: ${invoice.invoiceNumber}
              </div>
            </td>
          </tr>
          <!-- Legal line -->
          <tr>
            <td colspan="2" style="padding-top:12px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#c4c9d8;line-height:1.6;text-align:center;border-top:1px solid #e8eeff;padding-top:10px;">
                ${brand.footerLegal}
                &nbsp;|&nbsp;
                <a href="mailto:${brand.replyTo}?subject=unsubscribe" style="color:#c4c9d8;">Unsubscribe</a>
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
  const brand     = getBrand(invoice.brandId);
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const confItems: LineItem[] = Array.isArray(invoice.lineItems) ? invoice.lineItems as unknown as LineItem[] : [];
  const packageLabel = derivePackageLabel(confItems);
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
  <title>Payment Confirmed — ${brand.name}</title>
  <style>
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    @media only screen and (max-width:640px) {
      .email-container { width:100% !important; }
      .mobile-pad      { padding:20px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg};">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg};line-height:1px;max-width:0;">
  Payment received! Your ${brand.id === 'catalyst' ? 'Career Booster Package' : 'Project'} is now active. Work begins within 24 hours.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${brand.id === 'catalyst' ? '#F0EDE6' : brand.emailBg}">
<tr><td align="center" style="padding:28px 12px;">

  <table role="presentation" class="email-container" width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(92,200,160,0.12);">

    <!-- Header -->
    <tr>
      <td style="background:${brand.gradient};padding:40px 36px;text-align:center;">
        <!-- Logo -->
        <div style="margin-bottom:16px;">
          <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
            <tr><td>${brand.logoEmailHtml(52)}</td></tr>
          </table>
        </div>
        <h1 style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">
          Payment Confirmed!
        </h1>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.88);line-height:1.6;">
          Thank you, <strong>${firstName}</strong>. Your ${brand.id === 'catalyst' ? 'Career Booster Package' : 'Project'} is now active<br/>and our team is ready to get to work.
        </p>
      </td>
    </tr>

    <!-- Accent bar -->
    <tr>
      <td height="3" style="background:${brand.accentBar};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- Payment Summary -->
    <tr>
      <td class="mobile-pad" style="padding:32px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#F5F3EE;border-radius:12px;border:1px solid #EDE9DF;overflow:hidden;">
          <tr>
            <td width="50%" style="padding:14px 18px;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Invoice</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:700;margin-top:4px;">${invoice.invoiceNumber}</div>
            </td>
            <td width="50%" style="padding:14px 18px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Amount Paid</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:${brand.primaryColor};font-weight:800;margin-top:4px;">${fmt(invoice.totalPayable)} ${invoice.currency}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;border-top:1px solid #EDE9DF;border-right:1px solid #EDE9DF;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Package</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${brand.primaryColor};font-weight:600;margin-top:4px;">${packageLabel}</div>
            </td>
            <td style="padding:12px 18px;border-top:1px solid #EDE9DF;">
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
              <div style="width:22px;height:22px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">1</div>
            </td>
            <td style="padding:0 0 12px 10px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;">Our team begins work within 24 hours</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:2px;">We'll review your details and get started.</div>
            </td>
          </tr>
          <tr>
            <td valign="top" width="28" style="padding-top:2px;">
              <div style="width:22px;height:22px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">2</div>
            </td>
            <td style="padding:0 0 12px 10px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0d1b4b;font-weight:600;">Delivery within 2–4 business days</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;margin-top:2px;">You'll receive your deliverables via email.</div>
            </td>
          </tr>
          <tr>
            <td valign="top" width="28" style="padding-top:2px;">
              <div style="width:22px;height:22px;background:${brand.id === 'catalyst' ? '#F5F2EC' : brand.emailBg};border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;font-family:Helvetica,Arial,sans-serif;color:${brand.primaryColor};">3</div>
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
               style="background:#f0fdf9;border-left:4px solid #10B981;border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#065f46;line-height:1.7;">
                Questions or need to share additional information?
                Reply directly to this email or reach us at&nbsp;
                <a href="mailto:${brand.replyTo}" style="color:#0d9466;font-weight:600;">${brand.replyTo}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#F5F3EE;padding:20px 36px;border-top:1px solid #EDE9DF;border-radius:0 0 16px 16px;text-align:center;">
        <table align="center" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 10px;">
          <tr><td>${brand.logoEmailHtml(30)}</td></tr>
        </table>
        <div style="font-family:${brand.fontSerif};font-size:13px;font-weight:400;color:${brand.primaryColor};letter-spacing:2px;margin-bottom:6px;">
          ${brand.name.toUpperCase()}
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#9ca3af;">
          <a href="${brand.websiteUrl}" style="color:#9ca3af;text-decoration:none;">${brand.websiteLabel}</a>
          &nbsp;&bull;&nbsp;
          <a href="mailto:${brand.replyTo}" style="color:#9ca3af;text-decoration:none;">${brand.replyTo}</a>
          &nbsp;&bull;&nbsp;
          <a href="mailto:${brand.replyTo}?subject=unsubscribe" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
        </div>
      </td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`;
}
