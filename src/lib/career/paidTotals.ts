export interface PaidInvoiceInput {
  id: string;
  status: string;
  totalPayable: number;
  currency: string;
  installments: unknown;
  invoiceInstallments: { amount: number; status: string }[];
}

export interface PaidTotalsSummary {
  paidTotals: { currency: string; amount: number }[];
  paidInvoiceCount: number;
  includesLegacyProfileTotal: boolean;
}

function toCents(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function jsonInstallments(value: unknown): { amount: unknown; status: unknown }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is { amount: unknown; status: unknown } =>
    typeof row === 'object' && row !== null && 'amount' in row && 'status' in row,
  );
}

export function summarizePaidInvoices(
  invoices: PaidInvoiceInput[],
  legacyAmountPaid: number,
  legacyCurrency: string,
): PaidTotalsSummary {
  const centsByCurrency = new Map<string, number>();
  const seenInvoices = new Set<string>();
  let paidInvoiceCount = 0;
  let hasInvoicePayments = false;

  for (const invoice of invoices) {
    if (seenInvoices.has(invoice.id)) continue;
    seenInvoices.add(invoice.id);
    let invoicePaidCents = 0;

    if (invoice.status === 'PAID') {
      invoicePaidCents = toCents(invoice.totalPayable);
    } else if (invoice.status === 'PARTIALLY_PAID') {
      const rows = invoice.invoiceInstallments.length > 0
        ? invoice.invoiceInstallments
        : jsonInstallments(invoice.installments);
      invoicePaidCents = rows.reduce((sum, installment) =>
        installment.status === 'PAID' ? sum + toCents(installment.amount) : sum, 0);
    }

    if (invoicePaidCents > 0) {
      hasInvoicePayments = true;
      const currency = invoice.currency.trim().toUpperCase() || 'INR';
      centsByCurrency.set(currency, (centsByCurrency.get(currency) ?? 0) + invoicePaidCents);
      paidInvoiceCount += 1;
    }
  }

  // Older client records can have a settled profile total without invoice rows.
  // Use it only when invoice records contain no payment data, avoiding duplicates.
  const includesLegacyProfileTotal = toCents(legacyAmountPaid) > 0 && !hasInvoicePayments;
  if (includesLegacyProfileTotal) {
    const currency = legacyCurrency.trim().toUpperCase() || 'INR';
    centsByCurrency.set(currency, (centsByCurrency.get(currency) ?? 0) + toCents(legacyAmountPaid));
  }

  const paidTotals = [...centsByCurrency.entries()]
    .map(([currency, cents]) => ({ currency, amount: cents / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return { paidTotals, paidInvoiceCount, includesLegacyProfileTotal };
}
