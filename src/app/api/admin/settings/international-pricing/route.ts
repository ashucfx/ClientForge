import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCurrencyPricing, setSetting } from '@/lib/systemSettings';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pricingMap = await getGlobalCurrencyPricing();
    return NextResponse.json({ pricingMap });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch global pricing' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid map' }, { status: 400 });
    }
    await setSetting('GLOBAL_CURRENCY_PRICING', body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save global pricing' }, { status: 500 });
  }
}
