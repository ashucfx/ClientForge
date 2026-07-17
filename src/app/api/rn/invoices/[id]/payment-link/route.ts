// src/app/api/rn/invoices/[id]/payment-link/route.ts
// POST — generate a payment link for an RN invoice
// Auto-routes to Razorpay (India) or PayPal (international)
// based on invoice.paymentGateway field.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });

  const gateway = invoice.paymentGateway ?? 'RAZORPAY';

  try {
    if (gateway === 'PAYPAL') {
      // If PayPal invoice link already generated, return it
      if (invoice.paypalInvoiceId) {
        // PayPal invoices have a direct pay URL
        const payUrl = `https://www.paypal.com/invoice/payerView/details/${invoice.paypalInvoiceId}`;
        return NextResponse.json({ url: payUrl, gateway: 'PAYPAL' });
      }

      // Generate a new PayPal invoice via API
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const secret   = process.env.PAYPAL_SECRET;
      if (!clientId || !secret) {
        return NextResponse.json({ error: 'PayPal is not configured on this server.' }, { status: 503 });
      }

      // Get PayPal access token
      const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });
      if (!tokenRes.ok) throw new Error('PayPal auth failed');
      const { access_token } = await tokenRes.json();

      // Create PayPal invoice
      const invoiceRes = await fetch('https://api-m.paypal.com/v2/invoicing/invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail: {
            invoice_number: invoice.invoiceNumber,
            currency_code: invoice.currency ?? 'USD',
            note: `Invoice from Ripple Nexus — ${invoice.invoiceNumber}`,
          },
          invoicer: { name: { business_name: 'Ripple Nexus' } },
          primary_recipients: [{
            billing_info: {
              name: { full_name: invoice.clientName },
              email_address: invoice.clientEmail,
            },
          }],
          items: [{
            name: invoice.invoiceNumber,
            description: 'Project Services',
            quantity: '1',
            unit_amount: { currency_code: invoice.currency ?? 'USD', value: String(invoice.totalPayable.toFixed(2)) },
          }],
          amount: {
            breakdown: {
              item_total: { currency_code: invoice.currency ?? 'USD', value: String(invoice.totalPayable.toFixed(2)) },
            },
          },
        }),
      });
      const invoiceData = await invoiceRes.json();
      const ppInvoiceId: string = invoiceData.id ?? invoiceData.href?.split('/').pop();
      if (!ppInvoiceId) throw new Error('PayPal invoice creation failed');

      // Send the invoice (makes it payable)
      await fetch(`https://api-m.paypal.com/v2/invoicing/invoices/${ppInvoiceId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_to_recipient: true }),
      });

      // Store PayPal invoice ID
      await prisma.invoice.update({ where: { id: params.id }, data: { paypalInvoiceId: ppInvoiceId } });

      return NextResponse.json({
        url: `https://www.paypal.com/invoice/payerView/details/${ppInvoiceId}`,
        gateway: 'PAYPAL',
      });
    }

    // ── Razorpay Payment Link ──
    const rzpKey = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    if (!rzpKey || !rzpSecret) {
      return NextResponse.json({ error: 'Razorpay is not configured on this server.' }, { status: 503 });
    }

    // If already have a Razorpay link, return it
    if (invoice.razorpayLinkId) {
      const existing = await fetch(`https://api.razorpay.com/v1/payment_links/${invoice.razorpayLinkId}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64')}` },
      });
      if (existing.ok) {
        const d = await existing.json();
        if (d.short_url) return NextResponse.json({ url: d.short_url, gateway: 'RAZORPAY' });
      }
    }

    // Create a new Razorpay payment link
    const amountPaisa = Math.round(invoice.totalPayable * 100); // INR paise
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaisa,
        currency: invoice.currency ?? 'INR',
        description: `Invoice ${invoice.invoiceNumber} — Ripple Nexus`,
        customer: { name: invoice.clientName, email: invoice.clientEmail },
        notify: { sms: false, email: false },
        reference_id: invoice.invoiceNumber,
        reminder_enable: true,
        notes: { invoice_id: invoice.id },
      }),
    });
    const linkData = await linkRes.json();
    if (!linkRes.ok || !linkData.short_url) {
      throw new Error(linkData.error?.description ?? 'Razorpay link creation failed');
    }

    // Store Razorpay link ID
    await prisma.invoice.update({ where: { id: params.id }, data: { razorpayLinkId: linkData.id } });

    return NextResponse.json({ url: linkData.short_url, gateway: 'RAZORPAY' });
  } catch (err) {
    console.error('[payment-link]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
