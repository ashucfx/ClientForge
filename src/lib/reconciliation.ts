// src/lib/reconciliation.ts
// Pure, side-effect-free invoice reconciliation logic (no DB, no I/O) so it can
// be unit-tested and reused. Each check is an INTERNAL-CONSISTENCY invariant that
// must hold regardless of which code path created the invoice or which fee rates
// were in effect at the time it was created.

import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';

// Currencies with no minor unit — reconciliation tolerance is looser (1 whole unit).
export const ZERO_DECIMAL = new Set(['INR', 'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'TWD', 'HUF']);

export interface ReconInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  brandId: string;
  createdAt: Date;
  lineItems: unknown;
  installments: unknown;
  installmentPlan: boolean;
  discountAmount: number;
  taxAmount: number;
  subtotalConverted: number;
  processingFeeConverted: number;
  totalPayable: number;
  paidAt: Date | null;
}

interface InstallmentLike {
  amount?: unknown;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/**
 * Returns a list of human-readable problems for one invoice, or [] if it reconciles.
 */
export function reconcileInvoice(inv: ReconInvoice): string[] {
  const problems: string[] = [];
  const tol = ZERO_DECIMAL.has(inv.currency) ? 1 : 0.02;
  const approxEq = (a: number, b: number) => Math.abs(a - b) <= tol;

  const total = num(inv.totalPayable);
  const subtotal = num(inv.subtotalConverted);
  const discount = num(inv.discountAmount) || 0;
  const tax = num(inv.taxAmount) || 0;
  const fee = num(inv.processingFeeConverted) || 0;

  // 1. Total must be a positive, finite number.
  if (!Number.isFinite(total) || total <= 0) {
    problems.push(`totalPayable is not a positive finite number (got ${inv.totalPayable})`);
    return problems; // nothing else is meaningful if the total is broken
  }
  if (!Number.isFinite(subtotal)) {
    problems.push(`subtotalConverted is not a finite number (got ${inv.subtotalConverted})`);
    return problems;
  }

  // 2. Total must equal subtotal + fee under one of the two known conventions:
  //    - admin path stores subtotalConverted AFTER discount+tax  -> total = subtotal + fee
  //    - checkout path stores subtotalConverted BEFORE discount  -> total = subtotal - discount + tax + fee
  const candidateAdmin = subtotal + fee;
  const candidateCheckout = subtotal - discount + tax + fee;
  if (!approxEq(total, candidateAdmin) && !approxEq(total, candidateCheckout)) {
    problems.push(
      `totalPayable ${total} ≠ subtotal+fee (admin convention ${candidateAdmin.toFixed(2)} / ` +
      `checkout convention ${candidateCheckout.toFixed(2)})`
    );
  }

  // 3. Line-item integrity (only when line items are present — legacy invoices may not be).
  const items = parseInvoiceLineItems(inv.lineItems);
  if (items.length > 0) {
    let gross = 0;
    for (const it of items) {
      gross += it.lineTotal;
      if (!approxEq(it.lineTotal, it.qty * it.unitPrice)) {
        problems.push(
          `line item "${it.description}" lineTotal ${it.lineTotal} ≠ qty×unitPrice ` +
          `(${it.qty}×${it.unitPrice}=${(it.qty * it.unitPrice).toFixed(2)})`
        );
      }
    }
    // Subtotal must reconcile with the line-item gross under one of the two conventions.
    const grossAdmin = gross - discount + tax; // admin: subtotal already includes discount+tax
    if (!approxEq(subtotal, grossAdmin) && !approxEq(subtotal, gross)) {
      problems.push(
        `subtotalConverted ${subtotal} doesn't reconcile with line items ` +
        `(gross ${gross.toFixed(2)}; with discount/tax ${grossAdmin.toFixed(2)})`
      );
    }
  }

  // 4. Installments (when present) must sum to the total.
  if (inv.installmentPlan && Array.isArray(inv.installments)) {
    const insts = inv.installments as InstallmentLike[];
    if (insts.length > 0) {
      const sum = insts.reduce((s, i) => s + (num(i.amount) || 0), 0);
      if (!approxEq(sum, total)) {
        problems.push(`installments sum ${sum.toFixed(2)} ≠ totalPayable ${total}`);
      }
    }
  }

  // 5. Status hygiene.
  if (inv.status === 'PAID' && !inv.paidAt) {
    problems.push('status is PAID but paidAt is null');
  }
  if (inv.status === 'PARTIALLY_PAID' && !inv.installmentPlan) {
    problems.push('status is PARTIALLY_PAID but this is not an installment plan');
  }

  return problems;
}

/** Coarse bucket key for the summary (text before the first space/number/paren). */
export function problemType(problem: string): string {
  return problem.split(/[\s(]/)[0].replace(/[^a-zA-Z]/g, '') || 'other';
}
