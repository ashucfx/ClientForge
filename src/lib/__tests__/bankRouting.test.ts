import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAccountSwiftCapable, getBankRoutingIntelligence, resolveBankAccountForInvoice } from '../bankRouting';
import { getServiceDescription, SERVICE_DESCRIPTIONS } from '../pricing';
import { parseInvoiceLineItems } from '../invoiceLineItems';
import { convertForeignToInr } from '../currency';
import { prisma } from '../db';

describe('isAccountSwiftCapable', () => {
  it('detects isSwiftAvailable flag', () => {
    expect(isAccountSwiftCapable({ isSwiftAvailable: true, swiftBic: null, transferRail: 'ACH', routingType: null })).toBe(true);
  });

  it('detects valid swiftBic code', () => {
    expect(isAccountSwiftCapable({ isSwiftAvailable: false, swiftBic: 'SXPYDEHH', transferRail: 'SEPA', routingType: null })).toBe(true);
  });

  it('detects SWIFT rail or routingType', () => {
    expect(isAccountSwiftCapable({ isSwiftAvailable: false, swiftBic: null, transferRail: 'SWIFT', routingType: null })).toBe(true);
    expect(isAccountSwiftCapable({ isSwiftAvailable: false, swiftBic: null, transferRail: 'Wire', routingType: 'BIC_SWIFT' })).toBe(true);
  });

  it('returns false for pure ACH without swift bic', () => {
    expect(isAccountSwiftCapable({ isSwiftAvailable: false, swiftBic: null, transferRail: 'ACH', routingType: 'ach_routing_number' })).toBe(false);
  });
});

describe('getServiceDescription & pre-filled component descriptions', () => {
  it('returns appropriate tier-tailored descriptions', () => {
    const fresherResume = getServiceDescription('RESUME', 'FRESHER');
    expect(fresherResume).toContain('ATS-optimized');

    const execResume = getServiceDescription('RESUME', 'EXECUTIVE');
    expect(execResume).toContain('Executive-grade');

    const execPortfolio = getServiceDescription('PORTFOLIO', 'EXECUTIVE');
    expect(execPortfolio).toContain('Executive bio');

    const midLinkedin = getServiceDescription('LINKEDIN', 'MID_CAREER');
    expect(midLinkedin).toContain('LinkedIn transformation');

    const execConnect = getServiceDescription('EXECUTIVE_CONNECT', 'EXECUTIVE');
    expect(execConnect).toContain('executive positioning');
  });

  it('parses and normalizes line items with shortDescription', () => {
    const items = parseInvoiceLineItems([
      {
        id: 'item-1',
        description: 'Professional Resume Writing',
        shortDescription: 'ATS-optimized entry-level resume',
        qty: 1,
        unitPrice: 999,
        lineTotal: 999,
      }
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].shortDescription).toBe('ATS-optimized entry-level resume');
  });
});

describe('getBankRoutingIntelligence', () => {
  it('enforces domestic India restrictions for INR transactions', async () => {
    const routing = await getBankRoutingIntelligence({ currency: 'INR', country: 'India' });
    expect(routing.isIndia).toBe(true);
    expect(routing.razorpay.available).toBe(true);
    expect(routing.razorpay.isDomestic).toBe(true);
    expect(routing.paypal.available).toBe(false);
    expect(routing.nativeTransfer.available).toBe(false);
    expect(routing.swiftTransfer.available).toBe(false);
  });
});

describe('convertForeignToInr', () => {
  it('correctly converts foreign currencies when exchangeRate < 1 (foreign units per INR)', () => {
    // $100 USD at 0.012 USD/INR should be approx 8333 INR, NOT 1.2 INR!
    const inr = convertForeignToInr(100, 'USD', 0.012);
    expect(inr).toBe(8333);

    // £100 GBP at 0.0094 GBP/INR should be approx 10638 INR
    const gbpInr = convertForeignToInr(100, 'GBP', 0.0094);
    expect(gbpInr).toBe(10638);
  });

  it('handles INR natively', () => {
    expect(convertForeignToInr(5000, 'INR', 1)).toBe(5000);
  });

  it('handles fallback parity when exchangeRate is missing or 1 for USD', () => {
    // If rate is erroneously 1 for USD, it should fall back to ~83.5 parity, not 100 INR
    const inr = convertForeignToInr(100, 'USD', 1);
    expect(inr).toBe(8350);
  });
});

