import { ClientType } from '@prisma/client';

export type ServiceSlug = 'RESUME' | 'LINKEDIN' | 'COVER_LETTER' | 'PORTFOLIO';

export type PackageSlug = 'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM';

export type CurrencyCode = 'INR' | 'USD';

export interface PricingConfig {
  basePrices: {
    INR: Record<ServiceSlug, Record<ClientType, number>>;
    USD: Record<ServiceSlug, Record<ClientType, number>>;
  };
  packageDiscounts: Record<PackageSlug, number>; // Percentage off (e.g. 0.10 for 10% off)
}

// These are base prices per currency. 
// Having static USD prices allows for clean numbers (e.g. $149) rather than weird exchange rate fractions.
export const PRICING: PricingConfig = {
  basePrices: {
    INR: {
      RESUME: {
        FRESHER: 1999,
        MID_CAREER: 3999,
        EXECUTIVE: 5999,
        EXECUTIVE_PLUS: 8999,
        AGENCY_CLIENT: 0,
      },
      LINKEDIN: {
        FRESHER: 999,
        MID_CAREER: 1999,
        EXECUTIVE: 2999,
        EXECUTIVE_PLUS: 4999,
        AGENCY_CLIENT: 0,
      },
      COVER_LETTER: {
        FRESHER: 499,
        MID_CAREER: 999,
        EXECUTIVE: 1499,
        EXECUTIVE_PLUS: 1999,
        AGENCY_CLIENT: 0,
      },
      PORTFOLIO: {
        FRESHER: 4999,
        MID_CAREER: 7999,
        EXECUTIVE: 12999,
        EXECUTIVE_PLUS: 19999,
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
        EXECUTIVE_PLUS: 129,
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
      }
    }
  },
  packageDiscounts: {
    CAREER_BOOSTER: 0.15, // 15% discount for Resume + LinkedIn + Cover Letter
    PREMIUM_PLUS: 0.20,   // 20% discount for all 4 services
    CUSTOM: 0.0,          // No package discount
  }
};

export interface PricingBreakdown {
  currency: CurrencyCode;
  currencySymbol: string;
  services: { slug: ServiceSlug; price: number }[];
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
}

/**
 * Calculates the exact pricing breakdown given the selected services, experience level, and country.
 * It artificially inflates the base cost so that the net revenue equals the base price.
 */
export function calculatePricing({ experienceLevel, services, packageSlug, countryCode }: PricingParams): PricingBreakdown {
  // If country is IN, use INR and Razorpay. Otherwise, use USD and PayPal.
  const isIndia = countryCode.toUpperCase() === 'IN';
  const currency: CurrencyCode = isIndia ? 'INR' : 'USD';
  const currencySymbol = isIndia ? '₹' : '$';
  const paymentGateway = isIndia ? 'RAZORPAY' : 'PAYPAL';

  let subtotal = 0;
  const serviceDetails: { slug: ServiceSlug; price: number }[] = [];

  for (const slug of services) {
    const price = PRICING.basePrices[currency][slug][experienceLevel] || 0;
    subtotal += price;
    serviceDetails.push({ slug, price });
  }

  const discountRate = PRICING.packageDiscounts[packageSlug] || 0;
  const discountAmount = subtotal * discountRate;
  const subtotalAfterDiscount = subtotal - discountAmount;

  // For INR (Razorpay), assume 18% GST. For PayPal (Export of Services), assume 0% GST.
  const taxRate = isIndia ? 0.18 : 0.0;
  const taxAmount = subtotalAfterDiscount * taxRate;

  const costWithTax = subtotalAfterDiscount + taxAmount;

  // GATEWAY RECOVERY MATH
  // Formula: Desired Net = Final * (1 - fee%) - fixedFee
  // Therefore: Final = (Desired Net + fixedFee) / (1 - fee%)
  let finalPayable = costWithTax;
  let internalGatewayFee = 0;

  if (paymentGateway === 'RAZORPAY') {
    // Razorpay standard: ~2% + 18% GST on the fee = 2.36% total
    const feePercent = 0.0236; 
    finalPayable = costWithTax / (1 - feePercent);
    internalGatewayFee = finalPayable - costWithTax;
  } else if (paymentGateway === 'PAYPAL') {
    // PayPal international standard: ~4.4% + $0.30 fixed
    const feePercent = 0.044;
    const fixedFee = 0.30; // $0.30 USD
    finalPayable = (costWithTax + fixedFee) / (1 - feePercent);
    internalGatewayFee = finalPayable - costWithTax;
  }

  // Rounding for clean numbers. For INR, round to whole number. For USD, round to 2 decimal places.
  if (currency === 'INR') {
    finalPayable = Math.ceil(finalPayable);
    internalGatewayFee = finalPayable - costWithTax;
  } else {
    finalPayable = Math.ceil(finalPayable * 100) / 100;
    internalGatewayFee = Math.round((finalPayable - costWithTax) * 100) / 100;
  }

  return {
    currency,
    currencySymbol,
    services: serviceDetails,
    subtotal: currency === 'INR' ? Math.round(subtotal) : subtotal,
    discountRate,
    discountAmount: currency === 'INR' ? Math.round(discountAmount) : discountAmount,
    subtotalAfterDiscount: currency === 'INR' ? Math.round(subtotalAfterDiscount) : subtotalAfterDiscount,
    taxRate,
    taxAmount: currency === 'INR' ? Math.round(taxAmount) : taxAmount,
    finalPayable,
    internalGatewayFee,
    netRevenue: currency === 'INR' ? Math.round(costWithTax) : costWithTax
  };
}
