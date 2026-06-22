const COUNTRY_CODES: Record<string, string> = {
  'India': 'IN', 'United States': 'US', 'USA': 'US', 'United States of America': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'United Arab Emirates': 'AE', 'UAE': 'AE',
  'Canada': 'CA', 'Australia': 'AU', 'Singapore': 'SG', 'Germany': 'DE',
  'France': 'FR', 'Netherlands': 'NL', 'Sweden': 'SE', 'Norway': 'NO',
  'Denmark': 'DK', 'Switzerland': 'CH', 'New Zealand': 'NZ', 'Japan': 'JP',
  'South Korea': 'KR', 'China': 'CN', 'Malaysia': 'MY', 'Thailand': 'TH',
  'Indonesia': 'ID', 'Philippines': 'PH', 'Pakistan': 'PK', 'Bangladesh': 'BD',
  'Sri Lanka': 'LK', 'Nepal': 'NP', 'Qatar': 'QA', 'Kuwait': 'KW',
  'Bahrain': 'BH', 'Saudi Arabia': 'SA', 'Oman': 'OM', 'South Africa': 'ZA',
  'Nigeria': 'NG', 'Kenya': 'KE', 'Ireland': 'IE', 'Spain': 'ES',
  'Italy': 'IT', 'Portugal': 'PT', 'Belgium': 'BE', 'Austria': 'AT',
  'Poland': 'PL', 'Turkey': 'TR', 'Israel': 'IL', 'Hong Kong': 'HK',
  'Taiwan': 'TW', 'Vietnam': 'VN', 'Finland': 'FI', 'Mexico': 'MX',
  'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO',
};

export function countryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const code = COUNTRY_CODES[country] ?? COUNTRY_CODES[country.trim()];
  if (!code) return '';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}
