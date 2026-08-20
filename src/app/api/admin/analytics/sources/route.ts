import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── 1. Portal invoice breakdown ────────────────────────────────────────────
  const paidInvoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      totalPayable: true,
      subtotalConverted: true,
      currency: true,
      currencySymbol: true,
      exchangeRate: true,
      processingFeeConverted: true,
      taxAmount: true,
      discountAmount: true,
      paidAt: true,
      brandId: true,
      paymentGateway: true,
    },
    orderBy: { paidAt: 'desc' },
    take: 50,
  });

  const invoicesWithInr = await Promise.all(
    paidInvoices.map(async (inv) => {
      const inrEquivalent = await amountToInr(inv.totalPayable, inv.currency);
      const netInr = await amountToInr(inv.subtotalConverted, inv.currency);
      return {
        ...inv,
        inrEquivalent: Math.round(inrEquivalent),
        netInr: Math.round(netInr),
        isRecent: inv.paidAt ? inv.paidAt >= thirtyDaysAgo : false,
      };
    })
  );

  // ── 2. Manual career clients (no portal invoice) ───────────────────────────
  const manualCareerClients = await db.careerClient.findMany({
    where: { invoiceId: null, amountPaid: { gt: 0 } },
    select: {
      id: true,
      name: true,
      email: true,
      amountPaid: true,
      currency: true,
      packageType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const manualCareerWithInr = await Promise.all(
    manualCareerClients.map(async (c) => ({
      ...c,
      inrEquivalent: Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR')),
      source: 'career_manual' as const,
      isRecent: c.createdAt >= thirtyDaysAgo,
    }))
  );

  // ── 3. Manual RN clients (no portal invoice) ──────────────────────────────
  const manualRnClients = await db.rnClient.findMany({
    where: { invoiceId: null, amountPaid: { gt: 0 } },
    select: {
      id: true,
      name: true,
      email: true,
      amountPaid: true,
      currency: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const manualRnWithInr = await Promise.all(
    manualRnClients.map(async (c) => ({
      ...c,
      inrEquivalent: Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR')),
      source: 'rn_manual' as const,
      isRecent: c.createdAt >= thirtyDaysAgo,
    }))
  );

  // ── 4. NPS / Feedback data ──────────────────────────────────────────────────
  const feedbacks = await db.feedback.findMany({
    select: {
      id: true,
      npsScore: true,
      rating: true,
      communication: true,
      deliveryQuality: true,
      turnaroundTime: true,
      serviceType: true,
      comments: true,
      createdAt: true,
      careerClientId: true,
      rnClientId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // ── 5. Totals summary ──────────────────────────────────────────────────────
  const invoiceTotalInr = invoicesWithInr.reduce((s, i) => s + i.inrEquivalent, 0);
  const careerManualTotalInr = manualCareerWithInr.reduce((s, c) => s + c.inrEquivalent, 0);
  const rnManualTotalInr = manualRnWithInr.reduce((s, c) => s + c.inrEquivalent, 0);
  const grandTotal = invoiceTotalInr + careerManualTotalInr + rnManualTotalInr;

  // Lifetime NPS from all feedbacks
  const allFeedbacksForNps = await db.feedback.findMany({
    select: { npsScore: true, rating: true },
  });
  const totalFb = allFeedbacksForNps.length;
  const promoters = allFeedbacksForNps.filter(f => f.npsScore >= 9).length;
  const detractors = allFeedbacksForNps.filter(f => f.npsScore <= 6).length;
  const lifetimeNps = totalFb > 0 ? Math.round(((promoters - detractors) / totalFb) * 100) : null;
  const lifetimeAvgRating = totalFb > 0
    ? Number((allFeedbacksForNps.reduce((s, f) => s + f.rating, 0) / totalFb).toFixed(1))
    : null;

  return NextResponse.json({
    summary: {
      grandTotal,
      invoiceTotalInr,
      careerManualTotalInr,
      rnManualTotalInr,
      invoiceCount: invoicesWithInr.length,
      manualCareerCount: manualCareerWithInr.length,
      manualRnCount: manualRnWithInr.length,
      feedbackCount: totalFb,
      lifetimeNps,
      lifetimeAvgRating,
      promoters,
      detractors,
      passives: totalFb - promoters - detractors,
    },
    invoices: invoicesWithInr,
    manualCareer: manualCareerWithInr,
    manualRn: manualRnWithInr,
    feedbacks,
  });
}
