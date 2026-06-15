// src/lib/currency.ts

import type { CurrencyInfo } from '@/types';

// ─────────────────────────────────────────────
// COUNTRY → CURRENCY MAPPING
// ─────────────────────────────────────────────
export const COUNTRY_CURRENCY_MAP: Record<string, CurrencyInfo> = {
  'India': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  'United States': { code: 'USD', symbol: '$', name: 'US Dollar' },
  'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound' },
  'Canada': { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  'Australia': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  'United Arab Emirates': { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  'Saudi Arabia': { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  'Singapore': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  'Germany': { code: 'EUR', symbol: '€', name: 'Euro' },
  'France': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Italy': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Spain': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Netherlands': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Belgium': { code: 'EUR', symbol: '€', name: 'Euro' },
  'New Zealand': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  'Japan': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  'South Korea': { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  'Malaysia': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  'Hong Kong': { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  'South Africa': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  'Nigeria': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  'Kenya': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  'Bangladesh': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  'Pakistan': { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  'Sri Lanka': { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  'Nepal': { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee' },
  'Switzerland': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  'Sweden': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  'Norway': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  'Denmark': { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  'Qatar': { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal' },
  'Kuwait': { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  'Bahrain': { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
  'Oman': { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
  'China': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  'Thailand': { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  'Philippines': { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  'Indonesia': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  'Vietnam': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  'Brazil': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  'Mexico': { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
};

// All supported countries list
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY_MAP).sort();

// All unique currencies
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = Array.from(
  new Map(
    Object.values(COUNTRY_CURRENCY_MAP).map(c => [c.code, c])
  ).values()
).sort((a, b) => a.code.localeCompare(b.code));

// ─────────────────────────────────────────────
// GET CURRENCY FOR COUNTRY
// ─────────────────────────────────────────────
export function getCurrencyForCountry(country: string): CurrencyInfo {
  return COUNTRY_CURRENCY_MAP[country] ?? { code: 'USD', symbol: '$', name: 'US Dollar' };
}

export function getCurrencyByCode(code: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) ?? 
    { code: 'USD', symbol: '$', name: 'US Dollar' };
}

// ─────────────────────────────────────────────
// EXCHANGE RATE FETCHER (with cache)
// ─────────────────────────────────────────────
const CACHE_TTL_HOURS = 6;

// In-memory cache for edge cases
const memoryCache: Record<string, { rate: number; expiresAt: number }> = {};

export async function getExchangeRate(baseCurrency: string, targetCurrency: string): Promise<number> {
  if (baseCurrency === targetCurrency) return 1;

  const cacheKey = `${baseCurrency}_${targetCurrency}`;
  // Check memory cache
  const cached = memoryCache[cacheKey];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  try {
    // Primary: ExchangeRate-API (free tier: 1500 calls/month)
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    
    let rate: number;

    if (apiKey) {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${baseCurrency}/${targetCurrency}`,
        { next: { revalidate: CACHE_TTL_HOURS * 3600 } }
      );
      const data = await res.json();
      if (data.result === 'success') {
        rate = data.conversion_rate;
      } else {
        throw new Error('ExchangeRate-API failed');
      }
    } else {
      // Fallback: Open Exchange Rates (no key needed for some endpoints)
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${baseCurrency}`,
        { next: { revalidate: CACHE_TTL_HOURS * 3600 } }
      );
      const data = await res.json();
      if (data.rates && data.rates[targetCurrency]) {
        rate = data.rates[targetCurrency];
      } else {
        throw new Error('Could not get exchange rate');
      }
    }

    // Store in memory cache
    memoryCache[cacheKey] = {
      rate,
      expiresAt: Date.now() + CACHE_TTL_HOURS * 3600 * 1000,
    };

    return rate;
  } catch (err) {
    console.error('Exchange rate fetch failed:', err);
    // Fallback rates (approximate, used only when API unavailable)
    let fallbackRate = 1;
    if (baseCurrency === 'USD') {
      const usdFallbacks: Record<string, number> = {
        INR: 83.5, GBP: 0.79, EUR: 0.92, AED: 3.67,
        SGD: 1.35, CAD: 1.37, AUD: 1.50, SAR: 3.75,
        MYR: 4.70, HKD: 7.80, JPY: 155.0, QAR: 3.64,
        NZD: 1.66, CHF: 0.91, SEK: 10.8, NOK: 10.9,
      };
      fallbackRate = usdFallbacks[targetCurrency] ?? 1;
    } else if (baseCurrency === 'INR') {
      const inrFallbacks: Record<string, number> = {
        USD: 0.012, GBP: 0.0095, EUR: 0.011, AED: 0.044,
        SGD: 0.016, CAD: 0.016, AUD: 0.018, SAR: 0.045,
        MYR: 0.056, HKD: 0.094, JPY: 1.85, QAR: 0.044,
        NZD: 0.020, CHF: 0.011, SEK: 0.13, NOK: 0.13,
      };
      fallbackRate = inrFallbacks[targetCurrency] ?? 0.012;
    }
    return fallbackRate;
  }
}
