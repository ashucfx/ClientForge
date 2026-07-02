// Client-safe: no server env vars, safe to import in 'use client' components.
// PayPal Invoice API v2 supported currencies — everything else is converted to USD.
export const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF',
  'ILS', 'JPY', 'MYR', 'MXN', 'NOK', 'NZD', 'PHP', 'PLN', 'RUB', 'SGD',
  'SEK', 'CHF', 'TWD', 'THB', 'USD',
]);
