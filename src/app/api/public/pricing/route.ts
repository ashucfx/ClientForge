import { NextResponse } from 'next/server';
import { getGlobalPricing } from '@/lib/pricing-v2';
import { getExecutiveConnectPricingMap } from '@/lib/systemSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getGlobalPricing();
    const executiveConnectPricing = await getExecutiveConnectPricingMap();
    return NextResponse.json({
      ...config,
      executiveConnectPricing,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}
