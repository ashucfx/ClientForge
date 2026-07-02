// src/app/api/currency/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate, getCurrencyForCountry, SUPPORTED_CURRENCIES, COUNTRIES } from '@/lib/currency';
import { calculatePricing } from '@/lib/pricing';
import type { ClientType } from '@/types';
import { isAdminRequest } from '@/lib/auth';

// GET /api/currency?country=India&clientType=FRESHER&services=resume,linkedin
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');
  const clientType = searchParams.get('clientType') as ClientType;
  const currencyOverride = searchParams.get('currency');
  const servicesParam = searchParams.get('services') ?? 'resume,linkedin';

  // Return supported currencies list if no params
  if (!country && !currencyOverride) {
    return NextResponse.json({ currencies: SUPPORTED_CURRENCIES, countries: COUNTRIES });
  }

  const currencyInfo = currencyOverride
    ? SUPPORTED_CURRENCIES.find(c => c.code === currencyOverride) ?? getCurrencyForCountry(country ?? '')
    : getCurrencyForCountry(country ?? '');

  const exchangeRate = await getExchangeRate('INR', currencyInfo.code);
  // usdRate is needed by the invoice page to convert USD base prices to local currency
  const usdRate = currencyInfo.code === 'INR' ? (1 / (await getExchangeRate('INR', 'USD'))) : await getExchangeRate('USD', currencyInfo.code);

  if (!clientType) {
    return NextResponse.json({
      currency: currencyInfo,
      exchangeRate,
      usdRate,
    });
  }

  const services = {
    resume: servicesParam.includes('resume'),
    linkedin: servicesParam.includes('linkedin'),
    coverLetter: servicesParam.includes('coverLetter'),
  };

  const pricing = calculatePricing(clientType, currencyInfo.code, exchangeRate, services);

  return NextResponse.json({
    currency: currencyInfo,
    exchangeRate,
    usdRate,
    pricing,
  });
}
