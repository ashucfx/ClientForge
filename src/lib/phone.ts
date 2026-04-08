// src/lib/phone.ts

import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js';

const COUNTRY_NAME_TO_ISO2: Record<string, CountryCode> = {
  'India': 'IN',
  'United States': 'US',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  'Singapore': 'SG',
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'New Zealand': 'NZ',
  'Japan': 'JP',
  'South Korea': 'KR',
  'Malaysia': 'MY',
  'Hong Kong': 'HK',
  'South Africa': 'ZA',
  'Nigeria': 'NG',
  'Kenya': 'KE',
  'Bangladesh': 'BD',
  'Pakistan': 'PK',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Qatar': 'QA',
  'Kuwait': 'KW',
  'Bahrain': 'BH',
  'Oman': 'OM',
  'China': 'CN',
  'Thailand': 'TH',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Vietnam': 'VN',
  'Brazil': 'BR',
  'Mexico': 'MX',
};

export function getIso2ForCountryName(countryName: string): CountryCode | null {
  return COUNTRY_NAME_TO_ISO2[countryName] ?? null;
}

export function getCallingCodeForCountryName(countryName: string): string | null {
  const iso2 = getIso2ForCountryName(countryName);
  if (!iso2) return null;
  return getCountryCallingCode(iso2);
}

export function normalizePhoneE164(input: string, countryName?: string): { e164: string; country?: CountryCode } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iso2 = countryName ? getIso2ForCountryName(countryName) : null;
  const parsed = trimmed.startsWith('+')
    ? parsePhoneNumberFromString(trimmed)
    : (iso2 ? parsePhoneNumberFromString(trimmed, iso2) : null);

  if (!parsed || !parsed.isValid()) return null;
  return { e164: parsed.number, country: parsed.country ?? iso2 ?? undefined };
}

// Razorpay `customer.contact` — keep E.164 with + prefix intact.
// Razorpay accepts +919876543210 format and routes SMS/email correctly for both
// Indian and international numbers.
export function toRazorpayContact(phone: string): string {
  // Strip formatting characters but preserve the leading +
  const stripped = phone.replace(/[^\d+]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

