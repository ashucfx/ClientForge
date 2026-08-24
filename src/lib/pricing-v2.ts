import { ClientType } from '@prisma/client';
import { getCurrencyForCountry, getExchangeRate } from './currency';

export type ServiceSlug = 'RESUME' | 'LINKEDIN' | 'COVER_LETTER' | 'PORTFOLIO' | 'EXECUTIVE_CONNECT';

export type PackageSlug = 'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM';

export type CurrencyCode = string; // e.g. 'INR', 'USD', 'SAR', 'AED', etc.

export interface PricingConfig {
  basePrices: {
    INR: Record<ServiceSlug, Record<ClientType, number>>;
    USD: Record<ServiceSlug, Record<ClientType, number>>;
  };
  packageDiscounts: Record<PackageSlug, number>; // Percentage off (e.g. 0.10 for 10% off)
}

import { getSetting } from './systemSettings';

// These are base prices per currency. 
// Having static USD prices allows for clean numbers (e.g. $149) rather than weird exchange rate fractions.
export const DEFAULT_PRICING: PricingConfig = {
  basePrices: {
    INR: {
      RESUME: {
        FRESHER: 999,
        MID_CAREER: 1999,
        EXECUTIVE: 3499,
        EXECUTIVE_PLUS: 4499,
        AGENCY_CLIENT: 0,
      },
      LINKEDIN: {
        FRESHER: 499,
        MID_CAREER: 999,
        EXECUTIVE: 1499,
        EXECUTIVE_PLUS: 1999,
        AGENCY_CLIENT: 0,
      },
      COVER_LETTER: {
        FRESHER: 249,
        MID_CAREER: 499,
        EXECUTIVE: 1499,
        EXECUTIVE_PLUS: 1999,
        AGENCY_CLIENT: 0,
      },
      PORTFOLIO: {
        FRESHER: 2499,
        MID_CAREER: 3999,
        EXECUTIVE: 12999,
        EXECUTIVE_PLUS: 19999,
        AGENCY_CLIENT: 0,
      },
      EXECUTIVE_CONNECT: {
        FRESHER: 0,
        MID_CAREER: 0,
        EXECUTIVE: 4999,
        EXECUTIVE_PLUS: 4999,
        AGENCY_CLIENT: 0,
      }
    },
    USD: {
      RESUME: {
        FRESHER: 49,
        MID_CAREER: 99,
        EXECUTIVE: 149,
        EXECUTIVE_PLUS: 199,
        AGENCY_CLIENT: 0,
      },
      LINKEDIN: {
        FRESHER: 29,
        MID_CAREER: 49,
        EXECUTIVE: 79,
        EXECUTIVE_PLUS: 109,
        AGENCY_CLIENT: 0,
      },
      COVER_LETTER: {
        FRESHER: 19,
        MID_CAREER: 29,
        EXECUTIVE: 49,
        EXECUTIVE_PLUS: 79,
        AGENCY_CLIENT: 0,
      },
      PORTFOLIO: {
        FRESHER: 149,
        MID_CAREER: 199,
        EXECUTIVE: 299,
        EXECUTIVE_PLUS: 399,
        AGENCY_CLIENT: 0,
      },
      EXECUTIVE_CONNECT: {
        FRESHER: 0,
        MID_CAREER: 0,
        EXECUTIVE: 100,
        EXECUTIVE_PLUS: 100,
        AGENCY_CLIENT: 0,
      }
    }
  },
  packageDiscounts: {
    CAREER_BOOSTER: 0.0,  // 0% discount by default
    PREMIUM_PLUS: 0.0,    // 0% discount by default
    CUSTOM: 0.0,          // No package discount
  }
};

export const PRICING = DEFAULT_PRICING;

export async function getGlobalPricing(): Promise<PricingConfig> {
  const config = await getSetting<PricingConfig>('GLOBAL_PRICING_V2');
  return config ?? DEFAULT_PRICING;
}

/**
 * Services that are included at no extra charge when purchased as part of a package.
 * These appear in the breakdown at ₹0/$0 with a "Complimentary" label.
 * When the same service is added standalone via CUSTOM, it is charged at the normal rate.
 */
export const PACKAGE_COMPLEMENTARY: Partial<Record<PackageSlug, ServiceSlug[]>> = {
  CAREER_BOOSTER: ['COVER_LETTER'],
  PREMIUM_PLUS:   ['COVER_LETTER'],
};

export interface PricingBreakdown {
  currency: CurrencyCode;
  currencySymbol: string;
  services: { slug: ServiceSlug; price: number; complimentary?: boolean }[];
  complementaryServices: ServiceSlug[];   // services zeroed out as part of package deal
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  
  // Tax
  taxRate: number; 
  taxAmount: number;

  // The final inflated cost to cover gateway fees
  finalPayable: number;
  
  // Internal breakdown (never show to client)
  internalGatewayFee: number;
  netRevenue: number;
}

export interface PricingParams {
  experienceLevel: ClientType;
  services: ServiceSlug[];
  packageSlug: PackageSlug;
  countryCode: string; // e.g. "IN" for India, "US" for USA
  countryName: string; // e.g. "Saudi Arabia"
  preferredGateway?: string; // allow Bank transfer string too
  couponCode?: string;
}

/**
 * Calculates the exact pricing breakdown given the selected services, experience level, and country.
 * It artificially inflates the base cost so that the net revenue equals the base price.
 */
export async function calculatePricing({ 
  experienceLevel, 
  services, 
  packageSlug, 
  countryCode,
  countryName,
  preferredGateway,
  couponCode
}: PricingParams): Promise<PricingBreakdown> {
  const { getExecutiveConnectPricingMap } = await import('./systemSettings');
  const globalPricing = await getGlobalPricing();
  const execConnectPricing = await getExecutiveConnectPricingMap();

  // If country is IN, use INR and Razorpay. Otherwise, start with USD base prices.
  const isIndia = countryCode.toUpperCase() === 'IN';
  
  // Base calculation is always done in INR or USD first (unless custom price exists)
  const baseCurrency: 'INR' | 'USD' = isIndia ? 'INR' : 'USD';
  
  // Final target currency and gateway.
  let currency: CurrencyCode = isIndia ? 'INR' : 'USD';
  let currencySymbol = isIndia ? '₹' : '$';
  let paymentGateway = isIndia ? 'RAZORPAY' : (preferredGateway || 'PAYPAL');
  let exchangeRate = 1;

  // If it's an international client explicitly requesting Razorpay or Bank Transfer, we convert USD to their local currency!
  if (!isIndia && paymentGateway.startsWith('RAZORPAY')) {
    const localCur = getCurrencyForCountry(countryName);
    currency = localCur.code;
    currencySymbol = localCur.symbol;
    exchangeRate = await getExchangeRate('USD', currency);
  }

  // Rounding for clean numbers.
  // For zero-decimal currencies like JPY or INR, round to whole numbers.
  const zeroDecimalCurrencies = ['INR', 'JPY', 'KRW', 'VND', 'IDR'];
  const isZeroDecimal = zeroDecimalCurrencies.includes(currency);
  const roundMoney = (v: number) => (isZeroDecimal ? Math.round(v) : Math.round(v * 100) / 100);

  let discountableSubtotal = 0;
  let nonDiscountableSubtotal = 0;
  const complementarySet = new Set(PACKAGE_COMPLEMENTARY[packageSlug] ?? []);
  const serviceDetails: { slug: ServiceSlug; price: number; complimentary?: boolean }[] = [];

  const customCurrencyMap = (currency === 'INR' || currency === 'USD') ? globalPricing.basePrices[currency] : null;

  for (const slug of services) {
    const isComplimentary = complementarySet.has(slug);
    
    // Check if we have an explicit backend price for this currency and service
    let price = 0;
    if (isComplimentary) {
      price = 0;
    } else if (slug === 'EXECUTIVE_CONNECT') {
      price = execConnectPricing[currency] || (execConnectPricing['USD'] * exchangeRate) || 0;
      price = roundMoney(price);
    } else if (customCurrencyMap && customCurrencyMap[slug] && customCurrencyMap[slug][experienceLevel] !== undefined) {
      // Direct hit on the new Global Currency table
      price = customCurrencyMap[slug][experienceLevel];
      // Note: custom prices are already exact native amounts, no exchange rate needed!
    } else {
      // Convert base (USD) to client's local currency if not INR/USD
      const basePrice = globalPricing.basePrices[baseCurrency][slug][experienceLevel] || 0;
      price = roundMoney(basePrice * exchangeRate);
    }

    if (slug === 'EXECUTIVE_CONNECT') {
      nonDiscountableSubtotal += price;
    } else {
      discountableSubtotal += price;
    }
    serviceDetails.push({ slug, price, ...(isComplimentary ? { complimentary: true } : {}) });
  }
  discountableSubtotal = roundMoney(discountableSubtotal);
  nonDiscountableSubtotal = roundMoney(nonDiscountableSubtotal);
  const subtotal = roundMoney(discountableSubtotal + nonDiscountableSubtotal);

  // Then apply package discount ONLY to discountable items
  const discountRate = globalPricing.packageDiscounts[packageSlug] || 0;
  const discountAmount = roundMoney(discountableSubtotal * discountRate);
  const subtotalAfterDiscount = roundMoney(subtotal - discountAmount);

  // For INR (Razorpay), assume 18% GST. For PayPal (Export of Services), assume 0% GST.
  const taxRate = isIndia ? 0.18 : 0.0;
  const taxAmount = roundMoney(subtotalAfterDiscount * taxRate);

  const costWithTax = roundMoney(subtotalAfterDiscount + taxAmount);

  // GATEWAY RECOVERY MATH
  // Formula: Desired Net = Final * (1 - fee%) - fixedFee
  // Therefore: Final = (Desired Net + fixedFee) / (1 - fee%)
  //
  // Rates recover the FULL cost of getting paid, not just the headline fee:
  //  - Razorpay domestic:      2% fee + 18% GST charged on the fee  = 2.36%
  //  - Razorpay international: 3% fee + 18% GST on the fee (3.54%)
  //    + ~2% currency-conversion spread Razorpay applies when settling
  //    foreign currency to INR                                       = 5.54%
  //  - PayPal: 4.4% + $0.30 fixed, + ~3% conversion spread PayPal
  //    applies when settling USD to an INR merchant account          = 7.4% + $0.30
  const RAZORPAY_DOMESTIC_FEE = 0.02 * 1.18;          // 2.36%
  const RAZORPAY_INTL_FEE     = 0.03 * 1.18 + 0.02;   // 5.54% incl. FX spread
  const PAYPAL_FEE            = 0.044 + 0.03;          // 7.4% incl. FX spread
  const PAYPAL_FIXED_FEE      = 0.30;                  // USD

  let finalPayable = costWithTax;
  let internalGatewayFee = 0;

  if (paymentGateway === 'RAZORPAY') {
    const feePercent = isIndia ? RAZORPAY_DOMESTIC_FEE : RAZORPAY_INTL_FEE;
    finalPayable = costWithTax / (1 - feePercent);
  } else if (paymentGateway === 'PAYPAL') {
    finalPayable = (costWithTax + PAYPAL_FIXED_FEE) / (1 - PAYPAL_FEE);
  }

  // Always round the customer-facing total UP so recovery never falls short.
  if (isZeroDecimal) {
    finalPayable = Math.ceil(finalPayable);
  } else {
    finalPayable = Math.ceil(finalPayable * 100) / 100;
  }
  internalGatewayFee = roundMoney(finalPayable - costWithTax);

  return {
    currency,
    currencySymbol,
    services: serviceDetails,
    complementaryServices: Array.from(complementarySet) as ServiceSlug[],
    subtotal,
    discountRate,
    discountAmount,
    subtotalAfterDiscount,
    taxRate,
    taxAmount,
    finalPayable,
    internalGatewayFee,
    netRevenue: costWithTax,
  };
}
