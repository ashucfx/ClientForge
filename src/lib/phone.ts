// src/lib/phone.ts

import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js';
import { ISO2_TO_COUNTRY } from './currency';

// Derive country-name → ISO2 from the single source of truth in currency.ts,
// so every supported country automatically gets a calling code + phone
// validation. Maintaining a second hand-written map here caused new countries
// to render "—" for their dial code and fail phone parsing.
const COUNTRY_NAME_TO_ISO2: Record<string, CountryCode> = Object.fromEntries(
  Object.entries(ISO2_TO_COUNTRY).map(([iso2, name]) => [name, iso2 as CountryCode]),
);

export function getIso2ForCountryName(countryName: string): CountryCode | null {
  return COUNTRY_NAME_TO_ISO2[countryName] ?? null;
}

export function getCallingCodeForCountryName(countryName: string): string | null {
  const iso2 = getIso2ForCountryName(countryName);
  if (!iso2) return null;
  try {
    return getCountryCallingCode(iso2);
  } catch {
    return null;
  }
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

// Razorpay `customer.contact` — digits only, NO + or 0 prefix.
// Razorpay API explicitly rejects any + or leading 0.
// E.164 +919876543210  →  919876543210  (12 digits, accepted by Razorpay)
export function toRazorpayContact(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

