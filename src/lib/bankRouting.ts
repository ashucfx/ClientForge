// src/lib/bankRouting.ts
import { prisma } from './db';
import { PAYPAL_SUPPORTED_CURRENCIES } from './paypal-currencies';
import type { InternationalBankAccount } from '@prisma/client';

export interface BankAccountSummary {
  id: string;
  currency: string;
  transferRail: string;
  accountName: string;
  bankName: string | null;
  accountNumber: string | null;
  iban: string | null;
  sortCode: string | null;
  routingNumber: string | null;
  routingType: string | null;
  swiftBic: string | null;
  bankAddress: string | null;
  referenceRequirements: string | null;
  paymentInstructions: string | null;
  country: string | null;
  isSwiftAvailable: boolean;
}

export interface BankRoutingIntelligence {
  currency: string;
  country: string;
  isIndia: boolean;
  razorpay: {
    available: boolean;
    isDomestic: boolean;
    label: string;
    feeDescription: string;
  };
  paypal: {
    available: boolean;
    willConvertToUsd: boolean;
    label: string;
    feeDescription: string;
    disabledReason?: string;
  };
  nativeTransfer: {
    available: boolean;
    account: BankAccountSummary | null;
    railName?: string;
    feeDescription: string;
    disabledReason?: string;
  };
  swiftTransfer: {
    available: boolean;
    account: BankAccountSummary | null;
    swiftBic?: string;
    feeDescription: string;
    disabledReason?: string;
  };
}

/**
 * Checks whether an active account is capable of accepting SWIFT wire transfers.
 */
export function isAccountSwiftCapable(acc: Pick<InternationalBankAccount, 'isSwiftAvailable' | 'swiftBic' | 'transferRail' | 'routingType'>): boolean {
  if (acc.isSwiftAvailable) return true;
  if (acc.swiftBic && acc.swiftBic.trim().length >= 8) return true;
  if (acc.routingType && acc.routingType.toUpperCase().includes('SWIFT')) return true;
  if (acc.transferRail && acc.transferRail.toUpperCase().includes('SWIFT')) return true;
  return false;
}

/**
 * Country-to-currency code helper for fallback matching
 */
const COUNTRY_CODE_TO_ISO2: Record<string, string> = {
  'united states': 'US',
  'usa': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'germany': 'DE',
  'france': 'FR',
  'italy': 'IT',
  'spain': 'ES',
  'netherlands': 'NL',
  'canada': 'CA',
  'australia': 'AU',
  'denmark': 'DK',
  'india': 'IN',
};

/**
 * Real-time routing intelligence for a given currency and country.
 * Queried by /api/currency and used by invoice creation & checkout forms.
 */
export async function getBankRoutingIntelligence({
  currency,
  country,
}: {
  currency: string;
  country: string;
}): Promise<BankRoutingIntelligence> {
  const cur = (currency || 'INR').trim().toUpperCase();
  const ctry = (country || '').trim().toLowerCase();
  const isIndia = ctry === 'india' || cur === 'INR';

  // 1. Razorpay
  const razorpay = {
    available: true,
    isDomestic: isIndia,
    label: isIndia ? 'Razorpay Domestic Link' : 'Razorpay Multi-Currency',
    feeDescription: isIndia ? 'UPI, NetBanking & Indian Cards (2.36%)' : 'International Multi-Currency (5.54%)',
  };

  // 2. PayPal
  const paypalWillConvertToUsd = !PAYPAL_SUPPORTED_CURRENCIES.has(cur);
  const paypal = {
    available: !isIndia,
    willConvertToUsd: paypalWillConvertToUsd,
    label: 'PayPal Invoice',
    feeDescription: isIndia ? 'Disabled for domestic INR' : 'Global PayPal & Cards (USD) (9.0% + $0.30)',
    disabledReason: isIndia ? 'PayPal is disabled for domestic INR accounts under RBI regulations' : undefined,
  };

  if (isIndia) {
    return {
      currency: cur,
      country,
      isIndia: true,
      razorpay,
      paypal,
      nativeTransfer: {
        available: false,
        account: null,
        feeDescription: '1.18% Fee (1% + 18% GST)',
        disabledReason: 'International bank transfer rails are disabled for domestic India transactions (use Razorpay UPI/NetBanking)',
      },
      swiftTransfer: {
        available: false,
        account: null,
        feeDescription: '3.54% Fee (3% + 18% GST)',
        disabledReason: 'SWIFT wire transfers are disabled for domestic INR transactions',
      },
    };
  }

  // Fetch all active bank accounts from DB with error resilience
  let activeAccounts: InternationalBankAccount[] = [];
  try {
    activeAccounts = await prisma.internationalBankAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch (err) {
    console.error('[bankRouting] Error fetching active accounts:', err);
  }

  const iso2 = COUNTRY_CODE_TO_ISO2[ctry] || '';

  // 3. Native Transfer Rail
  // Must match the currency exactly (or country if Eurozone) and NOT be exclusively SWIFT
  const nativeAccount = activeAccounts.find(a => {
    if (a.currency.toUpperCase() !== cur) {
      // Check Eurozone fallback: if country is in EU and account is EUR
      if (cur === 'EUR' && (a.country === 'EU' || (iso2 && a.country === iso2))) return true;
      return false;
    }
    // Cannot be exclusively SWIFT rail for native
    const rail = (a.transferRail || '').toUpperCase();
    return rail !== 'SWIFT';
  });

  const nativeTransfer = {
    available: Boolean(nativeAccount),
    account: nativeAccount ? (nativeAccount as BankAccountSummary) : null,
    railName: nativeAccount?.transferRail || undefined,
    feeDescription: '1.18% Fee (1% + 18% GST)',
    disabledReason: nativeAccount
      ? undefined
      : `No native local clearing account configured for ${cur}. Select SWIFT (in USD) or checkout via Razorpay/PayPal.`,
  };

  // 4. Global SWIFT Transfer Rail
  // Check if an active account exists for this currency with SWIFT capability
  let swiftAccount = activeAccounts.find(a => {
    if (a.currency.toUpperCase() !== cur) return false;
    return isAccountSwiftCapable(a);
  });

  // What if currency is USD and an account with SWIFT exists?
  // Or what if currency itself is an international currency without a local SWIFT account?
  const swiftTransfer = {
    available: Boolean(swiftAccount),
    account: swiftAccount ? (swiftAccount as BankAccountSummary) : null,
    swiftBic: swiftAccount?.swiftBic || undefined,
    feeDescription: '3.54% Fee (3% + 18% GST)',
    disabledReason: swiftAccount
      ? undefined
      : `SWIFT wire transfer is not configured for ${cur}. To accept a SWIFT wire from this client, invoice in USD (or configure a SWIFT receiving account in Settings).`,
  };

  return {
    currency: cur,
    country,
    isIndia: false,
    razorpay,
    paypal,
    nativeTransfer,
    swiftTransfer,
  };
}

/**
 * Resolves the exact InternationalBankAccount for invoice rendering & emails.
 * Uses smart matching across paymentGateway, currency, and country.
 */
export async function resolveBankAccountForInvoice({
  currency,
  country,
  paymentGateway,
}: {
  currency: string;
  country?: string | null;
  paymentGateway?: string | null;
}): Promise<InternationalBankAccount | null> {
  const cur = (currency || '').trim().toUpperCase();
  const gateway = paymentGateway || '';

  if (!gateway.startsWith('RAZORPAY_INTERNATIONAL_BANK_TRANSFER') && gateway !== 'BANK_TRANSFER') {
    return null;
  }

  const isSwiftRequested = gateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT';
  const isNativeRequested = gateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE';

  let accounts: InternationalBankAccount[] = [];
  try {
    accounts = await prisma.internationalBankAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('[BankRouting] Error resolving bank account for invoice:', error);
    return null;
  }

  if (accounts.length === 0) return null;

  const ctry = (country || '').trim().toLowerCase();
  const iso2 = COUNTRY_CODE_TO_ISO2[ctry] || '';

  // Filter by currency (or Eurozone)
  const currencyMatches = accounts.filter(a => {
    if (a.currency.toUpperCase() === cur) return true;
    if (cur === 'EUR' && (a.country === 'EU' || (iso2 && a.country === iso2))) return true;
    return false;
  });

  if (currencyMatches.length > 0) {
    if (isSwiftRequested) {
      // Find one with SWIFT enabled
      const swiftMatch = currencyMatches.find(a => isAccountSwiftCapable(a));
      if (swiftMatch) return swiftMatch;
      // If none explicitly marked, but BIC exists
      const bicMatch = currencyMatches.find(a => Boolean(a.swiftBic));
      if (bicMatch) return bicMatch;
      return currencyMatches[0];
    }

    if (isNativeRequested) {
      // Find non-SWIFT native rail
      const nativeMatch = currencyMatches.find(a => (a.transferRail || '').toUpperCase() !== 'SWIFT');
      if (nativeMatch) return nativeMatch;
      return currencyMatches[0];
    }

    return currencyMatches[0];
  }

  // Fallback: If SWIFT requested and invoice is billed in USD or another foreign currency,
  // check for active USD SWIFT account as primary correspondent
  if (isSwiftRequested) {
    const usdSwift = accounts.find(a => a.currency.toUpperCase() === 'USD' && isAccountSwiftCapable(a));
    if (usdSwift) return usdSwift;
  }

  // Fallback by country code if available
  if (iso2) {
    const countryMatch = accounts.find(a => a.country === iso2);
    if (countryMatch) return countryMatch;
  }

  return null;
}
