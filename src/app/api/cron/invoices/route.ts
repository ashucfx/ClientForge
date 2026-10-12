// src/app/api/cron/invoices/route.ts
// Syncs stale PENDING invoices with Razorpay and PayPal

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { onboardFromInvoice } from '@/lib/career/onboarding';

import { fetchPaypalInvoiceStatus } from '@/lib/paypal';
import { fetchPaymentLinkStatus } from '@/lib/razorpay';
import type { Installment } from '@/types';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find all PENDING invoices created within the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const staleInvoices = await db.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      createdAt: { gt: thirtyDaysAgo },
    },
    take: 50,
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
        const updatedInvoice = invoice.installmentPlan
          ? await db.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
              const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
              if (current.status === 'PAID') return null;

              const paidSeqs = (invoice.installments as unknown as Installment[])
                .filter(inst => inst.status === 'PAID')
                .map(inst => inst.seq);
              const claimed = await tx.invoiceInstallment.updateMany({
                where: { invoiceId: invoice.id, seq: { in: paidSeqs }, status: { not: 'PAID' } },
                data: { status: 'PAID', paidAt: new Date() },
              });
              if (claimed.count === 0) return null;

              const currentInstallments = (current.installments as unknown as Installment[]).map(inst =>
                paidSeqs.includes(inst.seq)
                  ? { ...inst, status: 'PAID' as const, paidAt: new Date().toISOString() }
                  : inst
              );
              const relationalInstallments = await tx.invoiceInstallment.findMany({
                where: { invoiceId: invoice.id },
                select: { status: true },
              });
              const currentStatus = relationalInstallments.every(inst => inst.status === 'PAID')
                ? 'PAID'
                : 'PARTIALLY_PAID';

              return tx.invoice.update({
                where: { id: invoice.id },
                data: {
                  status: currentStatus,
                  installments: currentInstallments as object[],
                  ...(currentStatus === 'PAID' ? { paidAt: new Date() } : {}),
                },
              });
            })
          : await db.$transaction(async (tx) => {
              const claimed = await tx.invoice.updateMany({
                where: { id: invoice.id, status: invoice.status },
                data: { status: newStatus as 'PAID' | 'PARTIALLY_PAID', ...(allPaid ? { paidAt: new Date() } : {}) },
              });
              if (claimed.count !== 1) return null;
              return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
            });
        if (!updatedInvoice) continue;
        
        if (allPaid) {
          await onboardFromInvoice(updatedInvoice).catch((err: unknown) => {
            console.error(`[Invoice Cron] Career Onboarding failed for invoice ${invoice.id}:`, err);
            return null;
          });
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
