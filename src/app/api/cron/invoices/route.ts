// src/app/api/cron/invoices/route.ts
// Syncs stale PENDING invoices with Razorpay and PayPal

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { onboardFromInvoice } from '@/lib/career/onboarding';
import { rnOnboardFromInvoice } from '@/lib/rn/onboarding';
import { fetchPaypalInvoiceStatus } from '@/lib/paypal';
import { fetchPaymentLinkStatus } from '@/lib/razorpay';
import type { Installment } from '@/types';

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
      let newStatus: string | null = null;
      let allPaid = false;

      // 1. Check Razorpay (if it has a razorpayLinkId)
      if (invoice.currency === 'INR' && invoice.razorpayLinkId) {
        if (invoice.installmentPlan) {
          const installs = (invoice.installments as unknown as Installment[]) || [];
          allPaid = true;
          for (const inst of installs) {
            if (inst.status !== 'PAID' && inst.razorpayLinkId) {
              const rzData = await fetchPaymentLinkStatus(inst.razorpayLinkId);
              if (rzData.status === 'paid') {
                inst.status = 'PAID';
                inst.paidAt = new Date().toISOString();
              } else {
                allPaid = false;
              }
            } else if (inst.status !== 'PAID') {
              allPaid = false;
            }
          }
          newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';
        } else {
          const rzData = await fetchPaymentLinkStatus(invoice.razorpayLinkId);
          if (rzData.status === 'paid') {
            newStatus = 'PAID';
            allPaid = true;
          }
        }
      } 
      // 2. Check PayPal
      else if (invoice.currency !== 'INR' && invoice.paypalInvoiceId) {
        if (invoice.installmentPlan) {
          const installs = (invoice.installments as unknown as Installment[]) || [];
          allPaid = true;
          for (const inst of installs) {
            if (inst.status !== 'PAID' && inst.paypalInvoiceId) {
              const { normalizedStatus } = await fetchPaypalInvoiceStatus(inst.paypalInvoiceId);
              if (normalizedStatus === 'PAID') {
                inst.status = 'PAID';
                inst.paidAt = new Date().toISOString();
              } else {
                allPaid = false;
              }
            } else if (inst.status !== 'PAID') {
              allPaid = false;
            }
          }
          newStatus = allPaid ? 'PAID' : 'PARTIALLY_PAID';
        } else {
          const { normalizedStatus } = await fetchPaypalInvoiceStatus(invoice.paypalInvoiceId);
          if (normalizedStatus === 'PAID') {
            newStatus = 'PAID';
            allPaid = true;
          }
        }
      }

      if (newStatus && newStatus !== invoice.status) {
        const updatedInvoice = await db.invoice.update({
          where: { id: invoice.id },
          data: { 
            status: newStatus as 'PAID' | 'PARTIALLY_PAID', 
            ...(allPaid ? { paidAt: new Date() } : {}),
            ...(invoice.installmentPlan ? { installments: invoice.installments as object[] } : {})
          },
        });
        
        if (allPaid) {
          if (updatedInvoice.brandId === 'ripple_nexus') {
            await rnOnboardFromInvoice(updatedInvoice as any).catch(err => {
              console.error(`[Invoice Cron] RN Onboarding failed for invoice ${invoice.id}:`, err);
            });
          } else {
            await onboardFromInvoice(updatedInvoice).catch(err => {
              console.error(`[Invoice Cron] Career Onboarding failed for invoice ${invoice.id}:`, err);
            });
          }
          synced++;
        }
      }
    } catch (err) {
      console.error(`[Invoice Cron] Failed to sync invoice ${invoice.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: staleInvoices.length, synced, failed });
}
