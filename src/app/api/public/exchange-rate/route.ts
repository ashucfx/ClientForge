export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate, getCurrencyForCountry } from '@/lib/currency';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';

export async function GET(req: NextRequest) {
  const limited = await enforcePublicRateLimit(req, {
    action: 'exchange_rate',
    ipLimit: { limit: 60, windowMs: 60 * 60 * 1000 },
  });
  if (limited) return limited;

  const country = req.nextUrl.searchParams.get('country') ?? '';
  if (!country) return NextResponse.json({ error: 'country required' }, { status: 400 });

  const info = getCurrencyForCountry(country);
  if (info.code === 'USD') {
    return NextResponse.json({ rate: 1, code: 'USD', symbol: '$' });
  }

  const rate = await getExchangeRate('USD', info.code);
  return NextResponse.json({ rate, code: info.code, symbol: info.symbol });
}
