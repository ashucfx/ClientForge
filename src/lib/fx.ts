// Live currency → INR conversion using ExchangeRate-API (open.exchangerate-api.com).
// Completely free, no API key needed, updates every 24 hours.
// Rates are cached in module memory for 12 hours to avoid hammering the API.

const API_URL = 'https://open.exchangerate-api.com/v6/latest/USD';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Hardcoded fallback rates (used if the API is down)
const FALLBACK: Record<string, number> = {
  USD: 1, INR: 83.5, GBP: 1.27, EUR: 1.09,
  SGD: 0.75, AUD: 0.66, CAD: 0.74, AED: 0.27,
};

type RateCache = { rates: Record<string, number>; cachedAt: number; source: 'live' | 'fallback' };
let _cache: RateCache | null = null;

async function fetchRatesFromUsd(): Promise<RateCache> {
  if (_cache && Date.now() - _cache.cachedAt < CACHE_TTL_MS) return _cache;

  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.rates?.INR) throw new Error('INR not in response');
    _cache = { rates: data.rates as Record<string, number>, cachedAt: Date.now(), source: 'live' };
    return _cache;
  } catch (err) {
    console.warn('[FX] Rate fetch failed, using fallback rates:', err);
    // Reuse expired cache if available (better than hardcoded fallback)
    if (_cache) return { ..._cache, source: 'fallback' };
    _cache = { rates: FALLBACK, cachedAt: Date.now(), source: 'fallback' };
    return _cache;
  }
}

// Convert `amount` in `currency` to INR using live rates.
// Cross-rate formula: amount_foreign → USD (divide by rate) → INR (multiply by INR rate)
export async function amountToInr(amount: number, currency: string): Promise<number> {
  if (!amount || amount === 0) return 0;
  const upper = (currency ?? 'INR').toUpperCase();
  if (upper === 'INR') return amount;

  const { rates } = await fetchRatesFromUsd();
  const inrPerUsd = rates['INR'] ?? 83.5;
  const foreignPerUsd = rates[upper];

  if (!foreignPerUsd) {
    console.warn(`[FX] Unknown currency ${upper}, assuming USD rate`);
    return amount * inrPerUsd;
  }

  // 1 USD = foreignPerUsd units of `currency`
  // So 1 unit of currency = (1 / foreignPerUsd) USD = (inrPerUsd / foreignPerUsd) INR
  return amount * (inrPerUsd / foreignPerUsd);
}

// Return a map of currency → INR rate (how many INR = 1 unit of that currency).
// Used by the API endpoint to return rates to the UI.
export async function getInrRates(): Promise<{
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  updatedAt: string;
}> {
  const cache = await fetchRatesFromUsd();
  const inrPerUsd = cache.rates['INR'] ?? 83.5;

  // Invert: rates map gives (1 USD = X foreign), we want (1 foreign = Y INR)
  const inrRates: Record<string, number> = {};
  for (const [cur, perUsd] of Object.entries(cache.rates)) {
    inrRates[cur] = parseFloat((inrPerUsd / perUsd).toFixed(4));
  }
  inrRates['INR'] = 1;

  return {
    rates: inrRates,
    source: cache.source,
    updatedAt: new Date(cache.cachedAt).toISOString(),
  };
}
