import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success') {
      throw new Error('Failed to fetch from open.er-api');
    }
    
    // the base price is 100 USD. We multiply the rate by 100 to get the local currency price.
    const suggestedPrices: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      // Format to integer or 2 decimals
      let price = (rate as number) * 100;
      if (price > 100) {
        price = Math.round(price); // For high values like INR (8300), JPY, round it to whole number
      } else {
        price = Number(price.toFixed(2)); // For like GBP, EUR, keep decimals if needed
      }
      suggestedPrices[code] = price;
    }

    return NextResponse.json({ suggestedPrices });
  } catch (err: any) {
    console.error('Failed to auto-fill rates', err);
    return NextResponse.json({ error: 'Failed to auto-fill rates' }, { status: 500 });
  }
}
