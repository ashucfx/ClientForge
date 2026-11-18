import { describe, expect, it } from 'vitest';
import { summarizePaidInvoices, type PaidInvoiceInput } from '@/lib/career/paidTotals';

function invoice(overrides: Partial<PaidInvoiceInput> & Pick<PaidInvoiceInput, 'id' | 'status'>): PaidInvoiceInput {
  return {
    id: overrides.id,
    status: overrides.status,
    totalPayable: overrides.totalPayable ?? 0,
    currency: overrides.currency ?? 'INR',
    installments: overrides.installments ?? [],
    invoiceInstallments: overrides.invoiceInstallments ?? [],
  };
}

describe('summarizePaidInvoices', () => {
  it('sums settled invoices and paid installments by currency while excluding unpaid invoices', () => {
    const result = summarizePaidInvoices([
      invoice({ id: 'paid-inr', status: 'PAID', totalPayable: 1250.5, currency: 'INR' }),
      invoice({ id: 'partial-inr', status: 'PARTIALLY_PAID', currency: 'INR', invoiceInstallments: [
        { amount: 200, status: 'PAID' }, { amount: 300, status: 'PENDING' },
      ] }),
      invoice({ id: 'paid-usd', status: 'PAID', totalPayable: 40, currency: 'USD' }),
      invoice({ id: 'pending', status: 'PENDING', totalPayable: 999, currency: 'INR' }),
      invoice({ id: 'cancelled', status: 'CANCELLED', totalPayable: 500, currency: 'INR' }),
    ], 1450.5, 'INR');

    expect(result).toEqual({
      paidTotals: [{ currency: 'INR', amount: 1450.5 }, { currency: 'USD', amount: 40 }],
      paidInvoiceCount: 3,
      includesLegacyProfileTotal: false,
    });
  });

  it('does not add the legacy profile amount to fully paid invoice totals', () => {
    const result = summarizePaidInvoices([
      invoice({ id: 'invoice-1', status: 'PAID', totalPayable: 800, currency: 'INR' }),
    ], 1600, 'INR');

    expect(result.paidTotals).toEqual([{ currency: 'INR', amount: 800 }]);
    expect(result.includesLegacyProfileTotal).toBe(false);
  });

  it('uses the legacy profile total when invoice records have no payment data', () => {
    const result = summarizePaidInvoices([], 975, 'inr');

    expect(result).toEqual({
      paidTotals: [{ currency: 'INR', amount: 975 }],
      paidInvoiceCount: 0,
      includesLegacyProfileTotal: true,
    });
  });

  it('does not duplicate partial invoice payments with the legacy profile total', () => {
    const result = summarizePaidInvoices([
      invoice({ id: 'partial', status: 'PARTIALLY_PAID', currency: 'INR', invoiceInstallments: [
        { amount: 250, status: 'PAID' }, { amount: 250, status: 'PENDING' },
      ] }),
    ], 250, 'INR');

    expect(result.paidTotals).toEqual([{ currency: 'INR', amount: 250 }]);
    expect(result.includesLegacyProfileTotal).toBe(false);
  });

  it('uses JSON installment data when relational installment rows are unavailable', () => {
    const result = summarizePaidInvoices([
      invoice({ id: 'partial', status: 'PARTIALLY_PAID', currency: 'USD', installments: [
        { amount: 55.25, status: 'PAID' }, { amount: 55.25, status: 'PENDING' },
      ] }),
    ], 0, 'INR');

    expect(result.paidTotals).toEqual([{ currency: 'USD', amount: 55.25 }]);
    expect(result.paidInvoiceCount).toBe(1);
  });
});
