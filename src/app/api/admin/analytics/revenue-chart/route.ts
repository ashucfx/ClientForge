import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Fetch all paid invoices
  const invoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: {
      id: true,
      totalPayable: true,
      subtotalConverted: true,  // net revenue (excl. processing fees)
      currency: true,
      brandId: true,
      sourceChannel: true,
      clientType: true,
      paidAt: true,
      createdAt: true,
    },
  });

  // 2. Fetch manual Career & RN clients (no invoiceId linked)
  const [manualCareer, manualRn] = await Promise.all([
    db.careerClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 } },
      select: { id: true, amountPaid: true, currency: true, createdAt: true },
    }),
    db.rnClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 } },
      select: { id: true, amountPaid: true, currency: true, createdAt: true },
    }),
  ]);

  const monthMap = new Map<string, { invoiceInr: number; externalInr: number; invoiceCount: number }>();
  const brandMap = new Map<string, { revenue: number; count: number }>();
  const channelMap = new Map<string, { revenue: number; count: number }>();
  const tierMap = new Map<string, { revenue: number; count: number }>();

  const ensureMonth = (m: string) => {
    if (!monthMap.has(m)) monthMap.set(m, { invoiceInr: 0, externalInr: 0, invoiceCount: 0 });
    return monthMap.get(m)!;
  };

  const addDrill = (map: Map<string, { revenue: number; count: number }>, key: string, inr: number) => {
    const normKey = key ? key.toLowerCase() : 'unknown';
    if (!map.has(normKey)) map.set(normKey, { revenue: 0, count: 0 });
    const e = map.get(normKey)!;
    e.revenue += inr;
    e.count += 1;
  };

  const normalizeChannel = (channel?: string | null): string => {
    if (!channel) return 'CLIENTFORGE_INVOICE';
    const c = channel.toUpperCase();
    if (c.includes('REFERRAL')) return 'CLIENT_REFERRAL';
    if (c.includes('GATEWAY')) return 'PAYMENT_GATEWAY_DIRECT';
    if (c.includes('PORTAL') || c.includes('MANUAL')) return 'MANUAL_PORTAL';
    if (c === 'DIRECT' || c === 'INVOICE') return 'CLIENTFORGE_INVOICE';
    return c;
  };

  // Convert invoices
  await Promise.all(
    invoices.map(async (inv) => {
      // Use subtotalConverted (net revenue) — excludes processing fees collected by gateway
      const inr = await amountToInr(inv.subtotalConverted ?? inv.totalPayable, inv.currency);
      const paidDate = inv.paidAt || inv.createdAt;
      const month = paidDate.toISOString().slice(0, 7);

      const mEntry = ensureMonth(month);
      mEntry.invoiceInr += inr;
      mEntry.invoiceCount += 1;

      addDrill(brandMap, inv.brandId || 'catalyst', inr);
      addDrill(channelMap, normalizeChannel(inv.sourceChannel), inr);
      addDrill(tierMap, inv.clientType || 'MID_SENIOR', inr);
    })
  );

  // Convert manual Career clients (Client Portal Onboardings)
  await Promise.all(
    manualCareer.map(async (c) => {
      const inr = await amountToInr(c.amountPaid, c.currency);
      const month = c.createdAt.toISOString().slice(0, 7);

      const mEntry = ensureMonth(month);
      mEntry.externalInr += inr;

      addDrill(brandMap, 'catalyst', inr);
      addDrill(channelMap, 'MANUAL_PORTAL', inr);
      addDrill(tierMap, 'CAREER_BOOSTER', inr);
    })
  );

  // Convert manual RN clients (Client Portal Onboardings)
  await Promise.all(
    manualRn.map(async (c) => {
      const inr = await amountToInr(c.amountPaid, c.currency);
      const month = c.createdAt.toISOString().slice(0, 7);

      const mEntry = ensureMonth(month);
      mEntry.externalInr += inr;

      addDrill(brandMap, 'ripple_nexus', inr);
      addDrill(channelMap, 'MANUAL_PORTAL', inr);
      addDrill(tierMap, 'B2B_AGENCY', inr);
    })
  );

  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      revenue: Math.round(v.invoiceInr + v.externalInr),
      invoiceRevenue: Math.round(v.invoiceInr),
      externalRevenue: Math.round(v.externalInr),
      count: v.invoiceCount,
    }));

  const byBrand = Array.from(brandMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([brand, v]) => ({ brand, revenue: Math.round(v.revenue), count: v.count }));

  const byChannel = Array.from(channelMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([channel, v]) => ({ channel: channel.toUpperCase(), revenue: Math.round(v.revenue), count: v.count }));

  const byTier = Array.from(tierMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([tier, v]) => ({ tier: tier.toUpperCase(), revenue: Math.round(v.revenue), count: v.count }));

  return NextResponse.json({
    monthly,
    byBrand,
    byChannel,
    byTier,
  });
}
