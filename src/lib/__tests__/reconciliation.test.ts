import { describe, it, expect } from 'vitest';
import { reconcileInvoice, type ReconInvoice } from '@/lib/reconciliation';

// Build a valid baseline invoice and let each test perturb one field.
function makeInvoice(overrides: Partial<ReconInvoice> = {}): ReconInvoice {
  return {
    id: 'inv1',
    invoiceNumber: 'INV-1',
    status: 'PENDING',
    currency: 'USD',
    brandId: 'catalyst',
    createdAt: new Date(),
    lineItems: [
      { id: 'a', description: 'Resume', qty: 1, unitPrice: 100, lineTotal: 100 },
      { id: 'b', description: 'LinkedIn', qty: 1, unitPrice: 50, lineTotal: 50 },
    ],
    installments: [],
    installmentPlan: false,
    // admin convention: subtotalConverted already includes discount+tax
    // gross 150, no discount, no tax -> subtotal 150; fee 5 -> total 155
    discountAmount: 0,
    taxAmount: 0,
    subtotalConverted: 150,
    processingFeeConverted: 5,
    totalPayable: 155,
    paidAt: null,
    ...overrides,
  };
}

describe('reconcileInvoice', () => {
  it('passes a consistent admin-convention invoice', () => {
    expect(reconcileInvoice(makeInvoice())).toEqual([]);
  });

  it('passes a consistent checkout-convention invoice (subtotal pre-discount)', () => {
    // gross 150, 15% discount = 22.5, no tax, fee 5
    // checkout: total = subtotal - discount + tax + fee = 150 - 22.5 + 0 + 5 = 132.5
    const inv = makeInvoice({
      discountAmount: 22.5,
      taxAmount: 0,
      subtotalConverted: 150,
      processingFeeConverted: 5,
      totalPayable: 132.5,
    });
    expect(reconcileInvoice(inv)).toEqual([]);
  });

  it('flags a drifted total', () => {
    const problems = reconcileInvoice(makeInvoice({ totalPayable: 200 }));
    expect(problems.some(p => p.includes('totalPayable'))).toBe(true);
  });

  it('flags a non-finite / non-positive total', () => {
    expect(reconcileInvoice(makeInvoice({ totalPayable: 0 })).length).toBeGreaterThan(0);
    expect(reconcileInvoice(makeInvoice({ totalPayable: NaN })).length).toBeGreaterThan(0);
  });

  it('flags a corrupted line item (lineTotal ≠ qty×unitPrice)', () => {
    const inv = makeInvoice({
      lineItems: [{ id: 'a', description: 'Resume', qty: 2, unitPrice: 100, lineTotal: 100 }],
    });
    const problems = reconcileInvoice(inv);
    expect(problems.some(p => p.includes('lineTotal'))).toBe(true);
  });

  it('flags installments that do not sum to the total', () => {
    const inv = makeInvoice({
      installmentPlan: true,
      installments: [{ amount: 50 }, { amount: 50 }], // 100 ≠ 155
    });
    const problems = reconcileInvoice(inv);
    expect(problems.some(p => p.includes('installments'))).toBe(true);
  });

  it('accepts installments that sum to the total', () => {
    const inv = makeInvoice({
      installmentPlan: true,
      installments: [{ amount: 77.5 }, { amount: 77.5 }], // 155
    });
    expect(reconcileInvoice(inv)).toEqual([]);
  });

  it('flags PAID invoices with no paidAt', () => {
    const problems = reconcileInvoice(makeInvoice({ status: 'PAID', paidAt: null }));
    expect(problems.some(p => p.includes('paidAt'))).toBe(true);
  });

  it('tolerates whole-unit rounding for zero-decimal currencies (INR)', () => {
    const inv = makeInvoice({
      currency: 'INR',
      lineItems: [{ id: 'a', description: 'Resume', qty: 1, unitPrice: 1999, lineTotal: 1999 }],
      discountAmount: 0,
      taxAmount: 0,
      subtotalConverted: 1999,
      processingFeeConverted: 47,
      totalPayable: 2046, // within 1-unit tolerance of 1999+47
    });
    expect(reconcileInvoice(inv)).toEqual([]);
  });

  it('skips line-item checks for legacy invoices with no line items', () => {
    const inv = makeInvoice({
      lineItems: [],
      subtotalConverted: 150,
      processingFeeConverted: 5,
      totalPayable: 155,
    });
    expect(reconcileInvoice(inv)).toEqual([]);
  });
});
