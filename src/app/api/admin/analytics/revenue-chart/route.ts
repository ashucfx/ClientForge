import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month');
  
  let currentStart: Date | null = null;
  let currentEnd: Date | null = null;

  if (monthParam) {
    const [y, m] = monthParam.split('-');
    const year = parseInt(y);
    const month = parseInt(m) - 1; // 0-indexed
    currentStart = new Date(year, month, 1);
    currentEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  }

  // 1. Fetch all settled invoices
  const invoices = await db.invoice.findMany({
    where: { status: 'PAID', amountSettledInr: { not: null } },
    select: {
      id: true,
      amountSettledInr: true,
      currency: true,
      brandId: true,
      sourceChannel: true,
      clientType: true,
      settledAt: true,
    },
  });

  // 2. Fetch settled Career & RN clients (no invoiceId linked)
  const [manualCareer, manualRn] = await Promise.all([
    db.careerClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, amountSettledInr: { not: null } },
      select: { id: true, amountSettledInr: true, settledAt: true },
    }),
    db.rnClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, amountSettledInr: { not: null } },
      select: { id: true, amountSettledInr: true, settledAt: true },
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

  const isWithinFilter = (date: Date | null) => {
    if (!date) return false;
    if (!currentStart || !currentEnd) return true;
    return date >= currentStart && date <= currentEnd;
  };

  invoices.forEach(inv => {
    const inr = inv.amountSettledInr ?? 0;
    const date = inv.settledAt;
    if (!date) return;
    
    // Always build the monthly chart data (maybe up to the selected month)
    if (!currentEnd || date <= currentEnd) {
      const month = date.toISOString().slice(0, 7);
      const mEntry = ensureMonth(month);
      mEntry.invoiceInr += inr;
      mEntry.invoiceCount += 1;
    }

    // Only build drilldowns for the selected filter period
    if (isWithinFilter(date)) {
      addDrill(brandMap, inv.brandId || 'catalyst', inr);
      addDrill(channelMap, normalizeChannel(inv.sourceChannel), inr);
      addDrill(tierMap, inv.clientType || 'MID_SENIOR', inr);
    }
  });

  manualCareer.forEach(c => {
    const inr = c.amountSettledInr ?? 0;
    const date = c.settledAt;
    if (!date) return;

    if (!currentEnd || date <= currentEnd) {
      const month = date.toISOString().slice(0, 7);
      const mEntry = ensureMonth(month);
      mEntry.externalInr += inr;
    }
    
    if (isWithinFilter(date)) {
      addDrill(brandMap, 'catalyst', inr);
      addDrill(channelMap, 'MANUAL_PORTAL', inr);
      addDrill(tierMap, 'CAREER_BOOSTER', inr);
    }
  });

  manualRn.forEach(c => {
    const inr = c.amountSettledInr ?? 0;
    const date = c.settledAt;
    if (!date) return;

    if (!currentEnd || date <= currentEnd) {
      const month = date.toISOString().slice(0, 7);
      const mEntry = ensureMonth(month);
      mEntry.externalInr += inr;
    }
    
    if (isWithinFilter(date)) {
      addDrill(brandMap, 'ripple_nexus', inr);
      addDrill(channelMap, 'MANUAL_PORTAL', inr);
      addDrill(tierMap, 'B2B_AGENCY', inr);
    }
  });

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
