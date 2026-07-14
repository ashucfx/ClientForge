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
  // ── Extended global coverage (Razorpay International presentment currencies) ──
  'Ireland': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Austria': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Portugal': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Finland': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Greece': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Luxembourg': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Slovakia': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Slovenia': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Estonia': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Latvia': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Lithuania': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Cyprus': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Malta': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Croatia': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Poland': { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  'Czech Republic': { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  'Hungary': { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  'Romania': { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  'Bulgaria': { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  'Turkey': { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  'Russia': { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  'Ukraine': { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  'Iceland': { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona' },
  'Israel': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  'Jordan': { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar' },
  'Lebanon': { code: 'LBP', symbol: 'L£', name: 'Lebanese Pound' },
  'Egypt': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  'Morocco': { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham' },
  'Tunisia': { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar' },
  'Ghana': { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  'Tanzania': { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  'Uganda': { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  'Zambia': { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
  'Mauritius': { code: 'MUR', symbol: '₨', name: 'Mauritian Rupee' },
  'Botswana': { code: 'BWP', symbol: 'P', name: 'Botswana Pula' },
  'Namibia': { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar' },
  'Taiwan': { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' },
  'Cambodia': { code: 'KHR', symbol: '៛', name: 'Cambodian Riel' },
  'Brunei': { code: 'BND', symbol: 'B$', name: 'Brunei Dollar' },
  'Macau': { code: 'MOP', symbol: 'MOP$', name: 'Macanese Pataca' },
  'Kazakhstan': { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  'Argentina': { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  'Chile': { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  'Colombia': { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  'Peru': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  'Uruguay': { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso' },
  'Costa Rica': { code: 'CRC', symbol: '₡', name: 'Costa Rican Colon' },
  'Fiji': { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar' },
  'Papua New Guinea': { code: 'PGK', symbol: 'K', name: 'Papua New Guinean Kina' },
};

// All supported countries list
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY_MAP).sort();

// ─────────────────────────────────────────────
// ISO-2 COUNTRY CODE → COUNTRY NAME (for geo-IP → currency resolution)
// Covers every country in COUNTRY_CURRENCY_MAP so a geo-detected visitor
// resolves to the right currency.
// ─────────────────────────────────────────────
export const ISO2_TO_COUNTRY: Record<string, string> = {
  IN: 'India',            US: 'United States',        GB: 'United Kingdom',
  CA: 'Canada',           AU: 'Australia',            AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',     SG: 'Singapore',            DE: 'Germany',
  FR: 'France',           IT: 'Italy',                ES: 'Spain',
  NL: 'Netherlands',      BE: 'Belgium',              NZ: 'New Zealand',
  JP: 'Japan',            KR: 'South Korea',          MY: 'Malaysia',
  HK: 'Hong Kong',        ZA: 'South Africa',         NG: 'Nigeria',
  KE: 'Kenya',            BD: 'Bangladesh',           PK: 'Pakistan',
  LK: 'Sri Lanka',        NP: 'Nepal',                CH: 'Switzerland',
  SE: 'Sweden',           NO: 'Norway',               DK: 'Denmark',
  QA: 'Qatar',            KW: 'Kuwait',               BH: 'Bahrain',
  OM: 'Oman',             CN: 'China',                TH: 'Thailand',
  PH: 'Philippines',      ID: 'Indonesia',            VN: 'Vietnam',
  BR: 'Brazil',           MX: 'Mexico',
  IE: 'Ireland',          AT: 'Austria',              PT: 'Portugal',
  FI: 'Finland',          GR: 'Greece',               LU: 'Luxembourg',
  SK: 'Slovakia',         SI: 'Slovenia',             EE: 'Estonia',
  LV: 'Latvia',           LT: 'Lithuania',            CY: 'Cyprus',
  MT: 'Malta',            HR: 'Croatia',              PL: 'Poland',
  CZ: 'Czech Republic',   HU: 'Hungary',              RO: 'Romania',
  BG: 'Bulgaria',         TR: 'Turkey',               RU: 'Russia',
  UA: 'Ukraine',          IS: 'Iceland',              IL: 'Israel',
  JO: 'Jordan',           LB: 'Lebanon',              EG: 'Egypt',
  MA: 'Morocco',          TN: 'Tunisia',              GH: 'Ghana',
  TZ: 'Tanzania',         UG: 'Uganda',               ZM: 'Zambia',
  MU: 'Mauritius',        BW: 'Botswana',             NA: 'Namibia',
  TW: 'Taiwan',           KH: 'Cambodia',             BN: 'Brunei',
  MO: 'Macau',            KZ: 'Kazakhstan',           AR: 'Argentina',
  CL: 'Chile',            CO: 'Colombia',             PE: 'Peru',
  UY: 'Uruguay',          CR: 'Costa Rica',           FJ: 'Fiji',
  PG: 'Papua New Guinea',
};

/** Resolve an ISO-2 code (e.g. "AE") to a supported country name, or null. */
export function countryNameFromIso(iso: string): string | null {
  return ISO2_TO_COUNTRY[iso.toUpperCase()] ?? null;
}

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
    const timeout = AbortSignal.timeout(5000);

    let rate: number;

    if (apiKey) {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${baseCurrency}/${targetCurrency}`,
        { next: { revalidate: CACHE_TTL_HOURS * 3600 }, signal: timeout }
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
        { next: { revalidate: CACHE_TTL_HOURS * 3600 }, signal: timeout }
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
    // Covers every currency in COUNTRY_CURRENCY_MAP
    const usdFallbacks: Record<string, number> = {
      INR: 83.5, GBP: 0.79, EUR: 0.92, AED: 3.67,
      SGD: 1.35, CAD: 1.37, AUD: 1.50, SAR: 3.75,
      MYR: 4.70, HKD: 7.80, JPY: 155.0, QAR: 3.64,
      NZD: 1.66, CHF: 0.91, SEK: 10.8, NOK: 10.9, DKK: 6.9,
      ZAR: 18.5, NGN: 1580.0, KES: 129.0, BDT: 110.0,
      PKR: 278.0, LKR: 310.0, NPR: 133.0, KRW: 1370.0,
      KWD: 0.307, BHD: 0.377, OMR: 0.385, CNY: 7.25,
      THB: 35.5, PHP: 56.5, IDR: 16200.0, VND: 25400.0,
      BRL: 5.0, MXN: 17.2,
      // Extended coverage (approximate — only used if the live rate API is down)
      PLN: 4.0, CZK: 23.0, HUF: 360.0, RON: 4.6, BGN: 1.8, TRY: 34.0,
      RUB: 92.0, UAH: 41.0, ISK: 138.0, ILS: 3.7, JOD: 0.709, LBP: 89500.0,
      EGP: 49.0, MAD: 9.9, TND: 3.1, GHS: 15.5, TZS: 2650.0, UGX: 3700.0,
      ZMW: 27.0, MUR: 46.0, BWP: 13.6, NAD: 18.5, TWD: 32.0, KHR: 4100.0,
      BND: 1.35, MOP: 8.05, KZT: 490.0, ARS: 1000.0, CLP: 950.0, COP: 4100.0,
      PEN: 3.75, UYU: 40.0, CRC: 510.0, FJD: 2.25, PGK: 3.9,
    };

    let fallbackRate = 1;
    if (baseCurrency === 'USD') {
      fallbackRate = usdFallbacks[targetCurrency] ?? 1;
    } else if (targetCurrency === 'USD' && usdFallbacks[baseCurrency]) {
      fallbackRate = 1 / usdFallbacks[baseCurrency];
    } else if (baseCurrency === 'INR') {
      const inrToUsd = 1 / usdFallbacks['INR'];
      fallbackRate = (usdFallbacks[targetCurrency] ?? 1) * inrToUsd;
    }

    if (fallbackRate === 1 && baseCurrency !== targetCurrency) {
      console.error(`No fallback rate for ${baseCurrency}→${targetCurrency}; defaulting to 1`);
    }
    return fallbackRate;
  }
}
