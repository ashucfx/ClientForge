import type { LineItem } from '@/types';

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeItem(value: unknown): LineItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const description = typeof item.description === 'string' ? item.description : '';
  if (!description.trim()) return null;

  const qty = Math.max(1, asNumber(item.qty));
  const unitPrice = asNumber(item.unitPrice);
  const lineTotal = asNumber(item.lineTotal) || qty * unitPrice;

  return {
    id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
    description,
    qty,
    unitPrice,
    lineTotal,
  };
}

export function parseInvoiceLineItems(value: unknown): LineItem[] {
  let raw = value;

  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeItem).filter((item): item is LineItem => Boolean(item));
}
