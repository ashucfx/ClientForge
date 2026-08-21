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

  // ── 1. ALL paid portal invoices (no take limit) ──────────────────────────
  const paidInvoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      totalPayable: true,         // gross (incl. fees/tax) — shown as "paid by client"
      subtotalConverted: true,    // net revenue — used for financial totals
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
    // NO take limit — we need ALL records
  });

  const invoicesWithInr = await Promise.all(
    paidInvoices.map(async (inv) => {
      // inrEquivalent = gross (what client paid including fees)
      const inrEquivalent = await amountToInr(inv.totalPayable, inv.currency);
      // netInr = net revenue you actually keep (subtotal after discount, before fees)
      const netInr = await amountToInr(inv.subtotalConverted, inv.currency);
      return {
        ...inv,
        inrEquivalent: Math.round(inrEquivalent),
        netInr: Math.round(netInr),
        isRecent: inv.paidAt ? inv.paidAt >= thirtyDaysAgo : false,
      };
    })
  );

  // ── 2. ALL manual career clients — no portal invoice (no take limit) ───────
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
    // NO take limit
  });

  const manualCareerWithInr = await Promise.all(
    manualCareerClients.map(async (c) => ({
      ...c,
      inrEquivalent: Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR')),
      source: 'career_manual' as const,
      isRecent: c.createdAt >= thirtyDaysAgo,
    }))
  );

  // ── 3. ALL manual RN clients — no portal invoice (no take limit) ─────────
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
    // NO take limit
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
      careerClient: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      rnClient: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // ── 5. Totals summary ──────────────────────────────────────────────────────
  // Use netInr (subtotalConverted) for financial totals — this is actual revenue you retain
  // (excludes payment processing fees and taxes collected on behalf)
  const invoiceTotalInr = invoicesWithInr.reduce((s, i) => s + i.netInr, 0);
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
    invoices: invoicesWithInr.slice(0, 100), // Display up to 100, but totals use ALL
    manualCareer: manualCareerWithInr,
    manualRn: manualRnWithInr,
    feedbacks,
  });
}
