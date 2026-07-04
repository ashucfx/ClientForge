import { describe, it, expect } from 'vitest';
import { calculatePricing, PRICING, type ServiceSlug } from '@/lib/pricing-v2';

// These tests lock in the money math. They assert structural properties that
// must hold regardless of the exact fee constants, so they catch revenue leaks
// and rounding drift without being brittle change-detectors.

// Fee constants mirrored from pricing-v2 (kept in sync intentionally — if these
// change, the "recovery is sufficient" assertions below must still pass).
const RAZORPAY_DOMESTIC_FEE = 0.02 * 1.18;
const RAZORPAY_INTL_FEE = 0.03 * 1.18 + 0.02;
const PAYPAL_FEE = 0.044 + 0.03;
const PAYPAL_FIXED_FEE = 0.3;

describe('calculatePricing — India / Razorpay (Career Booster, mid-career)', () => {
  const run = () =>
    calculatePricing({
      experienceLevel: 'MID_CAREER',
      services: ['RESUME', 'LINKEDIN', 'COVER_LETTER'] as ServiceSlug[],
      packageSlug: 'CAREER_BOOSTER',
      countryCode: 'IN',
      countryName: 'India',
    });

  it('bills in INR with 18% GST', async () => {
    const p = await run();
    expect(p.currency).toBe('INR');
    expect(p.taxRate).toBe(0.18);
  });

  it('makes the Cover Letter complimentary (₹0) in the package', async () => {
    const p = await run();
    const cover = p.services.find(s => s.slug === 'COVER_LETTER');
    expect(cover?.price).toBe(0);
    expect(cover?.complimentary).toBe(true);
  });

  it('subtotal equals the sum of the rounded line items', async () => {
    const p = await run();
    const sum = p.services.reduce((acc, s) => acc + s.price, 0);
    expect(p.subtotal).toBe(sum);
  });

  it('applies the 15% package discount', async () => {
    const p = await run();
    expect(p.discountRate).toBe(0.15);
    expect(p.discountAmount).toBe(Math.round(p.subtotal * 0.15));
  });

  it('rounds the INR total to a whole number', async () => {
    const p = await run();
    expect(Number.isInteger(p.finalPayable)).toBe(true);
  });

  it('recovers the full gateway fee — net revenue never falls short', async () => {
    const p = await run();
    // What actually lands after Razorpay takes its cut of finalPayable.
    const netAfterGateway = p.finalPayable * (1 - RAZORPAY_DOMESTIC_FEE);
    expect(netAfterGateway).toBeGreaterThanOrEqual(p.netRevenue - 0.01);
    expect(p.finalPayable).toBeGreaterThanOrEqual(p.netRevenue);
  });
});

describe('calculatePricing — International / PayPal (Premium Plus, executive)', () => {
  const run = () =>
    calculatePricing({
      experienceLevel: 'EXECUTIVE',
      services: ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'] as ServiceSlug[],
      packageSlug: 'PREMIUM_PLUS',
      countryCode: 'US',
      countryName: 'United States',
      preferredGateway: 'PAYPAL',
    });

  it('bills in USD with 0% GST (export of services)', async () => {
    const p = await run();
    expect(p.currency).toBe('USD');
    expect(p.taxRate).toBe(0);
  });

  it('applies the 20% package discount', async () => {
    const p = await run();
    expect(p.discountRate).toBe(0.2);
  });

  it('keeps at most 2 decimal places on the total', async () => {
    const p = await run();
    expect(Math.round(p.finalPayable * 100) / 100).toBe(p.finalPayable);
  });

  it('recovers PayPal percentage + fixed fee — net revenue never falls short', async () => {
    const p = await run();
    const netAfterGateway = p.finalPayable * (1 - PAYPAL_FEE) - PAYPAL_FIXED_FEE;
    expect(netAfterGateway).toBeGreaterThanOrEqual(p.netRevenue - 0.01);
  });
});

describe('calculatePricing — International Razorpay recovers FX spread', () => {
  it('nets at least the intended revenue after intl fee + FX spread', async () => {
    // Use a country whose currency maps cleanly; exchange rate uses fallback if
    // network is unavailable, so we assert the recovery property, not an amount.
    const p = await calculatePricing({
      experienceLevel: 'MID_CAREER',
      services: ['RESUME', 'LINKEDIN'] as ServiceSlug[],
      packageSlug: 'CUSTOM',
      countryCode: 'AE',
      countryName: 'United Arab Emirates',
      preferredGateway: 'RAZORPAY',
    });
    const netAfterGateway = p.finalPayable * (1 - RAZORPAY_INTL_FEE);
    expect(netAfterGateway).toBeGreaterThanOrEqual(p.netRevenue - 0.01);
  });
});

describe('calculatePricing — CUSTOM has no package discount', () => {
  it('charges each service at full rate with 0% discount', async () => {
    const p = await calculatePricing({
      experienceLevel: 'FRESHER',
      services: ['RESUME'] as ServiceSlug[],
      packageSlug: 'CUSTOM',
      countryCode: 'IN',
      countryName: 'India',
    });
    expect(p.discountRate).toBe(0);
    expect(p.discountAmount).toBe(0);
    expect(p.subtotal).toBe(PRICING.basePrices.INR.RESUME.FRESHER);
  });
});
