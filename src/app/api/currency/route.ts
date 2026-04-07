// src/app/api/currency/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRate, getCurrencyForCountry, SUPPORTED_CURRENCIES, COUNTRIES } from '@/lib/currency';
import { calculatePricing } from '@/lib/pricing';
import type { ClientType } from '@/types';

// GET /api/currency?country=India&clientType=FRESHER&services=resume,linkedin
export async function GET(request: NextRequest) {
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

  const exchangeRate = await getExchangeRate(currencyInfo.code);

  if (!clientType) {
    return NextResponse.json({
      currency: currencyInfo,
      exchangeRate,
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
    pricing,
  });
}
