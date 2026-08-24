import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/systemSettings';
import type { PricingConfig } from '@/lib/pricing-v2';
import { DEFAULT_PRICING } from '@/lib/pricing-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getSetting<PricingConfig>('GLOBAL_PRICING_V2');
    return NextResponse.json({ config: config ?? DEFAULT_PRICING });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await setSetting('GLOBAL_PRICING_V2', body);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
