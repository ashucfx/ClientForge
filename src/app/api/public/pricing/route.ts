import { NextResponse } from 'next/server';
import { getGlobalPricing } from '@/lib/pricing-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getGlobalPricing();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}
