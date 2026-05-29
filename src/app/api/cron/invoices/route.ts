// src/app/api/cron/invoices/route.ts
// Syncs stale PENDING invoices with Razorpay and PayPal

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { onboardFromInvoice } from '@/lib/career/onboarding';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find invoices that have been PENDING for more than 1 hour, but less than 30 days
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const staleInvoices = await db.invoice.findMany({
    where: {
      status: 'PENDING',
      createdAt: {
        lt: oneHourAgo,
        gt: thirtyDaysAgo,
      },
    },
    take: 50, // Process in batches
  });

  let synced = 0;
  let failed = 0;

  for (const invoice of staleInvoices) {
    try {
      let isPaid = false;

      // 1. Check Razorpay (if it has a razorpayLinkId)
      if (invoice.currency === 'INR' && invoice.razorpayLinkId) {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        const res = await fetch(`https://api.razorpay.com/v1/payment_links/${invoice.razorpayLinkId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'paid') isPaid = true;
        }
      } 
      // 2. Check PayPal
      else if (invoice.currency !== 'INR' && invoice.paypalInvoiceId) {
        const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });
        if (tokenRes.ok) {
          const { access_token } = await tokenRes.json();
          const invRes = await fetch(`https://api-m.paypal.com/v2/invoicing/invoices/${invoice.paypalInvoiceId}`, {
            headers: { Authorization: `Bearer ${access_token}` }
          });
          if (invRes.ok) {
            const data = await invRes.json();
            if (data.status === 'PAID') isPaid = true;
          }
        }
      }

      if (isPaid) {
        const updatedInvoice = await db.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        
        await onboardFromInvoice(updatedInvoice).catch(err => {
            console.error(`[Invoice Cron] Onboarding failed for invoice ${invoice.id}:`, err);
        });
        synced++;
      }
    } catch (err) {
      console.error(`[Invoice Cron] Failed to sync invoice ${invoice.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: staleInvoices.length, synced, failed });
}
