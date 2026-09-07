// src/emails/shared/LineItemTable.tsx
// Shared line-item table for invoice and proposal emails.

import { Section, Row, Column, Text } from '@react-email/components';
import * as React from 'react';
import type { BrandToken } from '@/lib/brand/types';
import type { LineItem } from '@/types';

interface LineItemTableProps {
  items: LineItem[];
  subtotal: number;
  discountRate?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  processingFeeRate?: number;
  processingFeeConverted?: number;
  sym: string;
  brand: BrandToken;
  fmt: (n: number) => string;
  /** When PayPal converts an unsupported currency to USD, pass the original currency code
   *  and rate (1 USD = X local) so clients see both USD and local amounts. */
  localCurrencyCode?: string;
  usdToLocalRate?: number;
}

export function LineItemTable({
  items,
  subtotal,
  discountRate = 0,
  discountAmount = 0,
  taxRate = 0,
  taxAmount = 0,
  processingFeeRate = 0,
  processingFeeConverted = 0,
  sym,
  brand,
  fmt,
  localCurrencyCode,
  usdToLocalRate,
}: LineItemTableProps) {
  const showLocal = !!(localCurrencyCode && usdToLocalRate && usdToLocalRate > 0);
  const localFmt = (usd: number) =>
    `≈ ${localCurrencyCode} ${(usd * usdToLocalRate!).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Compute true pre-discount gross subtotal from items (sum of qty * unitPrice)
  // Fall back to reconstructed gross if items array is empty (legacy invoices)
  const itemsGross = items.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
  const grossSubtotal = itemsGross > 0
    ? itemsGross
    : (discountAmount > 0 ? (subtotal - taxAmount + discountAmount) : subtotal);

  // When a discount applies, after-discount amount is grossSubtotal - discountAmount
  const afterDiscount = discountRate > 0 && discountAmount > 0
    ? Math.max(0, Math.round((grossSubtotal - discountAmount) * 100) / 100)
    : null;

  return (
    <Section style={{ margin: '20px 0 0', borderRadius: '10px', border: '1px solid #EDE9DF', overflow: 'hidden' }}>
      {/* Header row */}
      <Row style={{ background: '#F7F5F0', padding: '10px 16px' }}>
        <Column>
          <Text style={headerCell}>Services</Text>
        </Column>
        <Column style={{ textAlign: 'right' as const }}>
          <Text style={headerCell}>{discountRate > 0 ? 'Amount (Discounted)' : 'Amount'}</Text>
        </Column>
      </Row>

      {/* Line items */}
      {items.map((item, idx) => {
        const lt = item.qty * item.unitPrice;
        const isFree = lt === 0;
        const isLast = idx === items.length - 1;
        // When discount applies, show the discounted amount as primary
        const discountedLt = discountRate > 0 && !isFree
          ? Math.round(lt * (1 - discountRate / 100) * 100) / 100
          : lt;

        return (
          <Row
            key={item.id}
            className="li-row"
            style={{
              padding: '12px 16px',
              borderBottom: isLast ? 'none' : '1px solid #EDE9DF',
            }}
          >
            <Column style={{ verticalAlign: 'top' as const }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  background: isFree ? '#f0fdf4' : brand.primaryLight,
                  borderRadius: '50%',
                  textAlign: 'center' as const,
                  lineHeight: '24px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isFree ? '#16a34a' : brand.primaryColor,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <div>
                  <Text style={{ margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: 600, lineHeight: '1.4', wordBreak: 'break-word' as const }}>
                    {item.description}
                  </Text>
                  {item.qty > 1 && (
                    <Text style={{ margin: '3px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                      Qty: {item.qty} × {fmt(item.unitPrice)}
                    </Text>
                  )}
                </div>
              </div>
            </Column>
            <Column className="li-amount" style={{ textAlign: 'right' as const, verticalAlign: 'top' as const, width: '130px' }}>
              {isFree ? (
                <span style={{
                  fontSize: '11px',
                  color: '#16a34a',
                  fontWeight: 700,
                  background: '#f0fdf4',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  border: '1px solid #bbf7d0',
                  whiteSpace: 'nowrap' as const,
                }}>
                  FREE
                </span>
              ) : discountRate > 0 ? (
                <>
                  {/* Discounted price — primary */}
                  <Text style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                    {fmt(discountedLt)}
                  </Text>
                  {/* Original full price — muted reference */}
                  <Text style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' as const, textDecoration: 'line-through' }}>
                    {fmt(lt)}
                  </Text>
                  {showLocal && (
                    <Text style={{ margin: '1px 0 0', fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' as const }}>
                      {localFmt(discountedLt)}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                    {fmt(lt)}
                  </Text>
                  {showLocal && (
                    <Text style={{ margin: '3px 0 0', fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' as const }}>
                      {localFmt(lt)}
                    </Text>
                  )}
                </>
              )}
            </Column>
          </Row>
        );
      })}

      {/* Subtotal / adjustments */}
      <Row style={{ background: '#FAFAF8', padding: '8px 16px 2px', borderTop: '1px solid #EDE9DF' }}>
        <Column><Text style={summaryLabel}>Subtotal</Text></Column>
        <Column style={{ textAlign: 'right' as const }}>
          <Text style={summaryValue}>{fmt(grossSubtotal)}</Text>
          {showLocal && <Text style={localNote}>{localFmt(grossSubtotal)}</Text>}
        </Column>
      </Row>

      {discountRate > 0 && discountAmount > 0 && (
        <Row style={{ background: '#FAFAF8', padding: '2px 16px' }}>
          <Column><Text style={{ ...summaryLabel, color: '#16a34a' }}>Discount ({discountRate}%)</Text></Column>
          <Column style={{ textAlign: 'right' as const }}>
            <Text style={{ ...summaryValue, color: '#16a34a' }}>−{fmt(discountAmount)}</Text>
            {showLocal && <Text style={localNote}>{localFmt(discountAmount)}</Text>}
          </Column>
        </Row>
      )}

      {/* After Discount sub-total — only shown when a discount is active */}
      {afterDiscount !== null && (
        <Row style={{ background: '#F0FAF4', padding: '4px 16px', borderTop: '1px solid #dcfce7', borderBottom: '1px solid #dcfce7' }}>
          <Column>
            <Text style={{ ...summaryLabel, color: '#15803d', fontWeight: 600 }}>After Discount</Text>
          </Column>
          <Column style={{ textAlign: 'right' as const }}>
            <Text style={{ ...summaryValue, color: '#15803d', fontWeight: 700 }}>{fmt(afterDiscount)}</Text>
            {showLocal && <Text style={localNote}>{localFmt(afterDiscount)}</Text>}
          </Column>
        </Row>
      )}

      {taxRate > 0 && taxAmount > 0 && (
        <Row style={{ background: '#FAFAF8', padding: '2px 16px' }}>
          <Column><Text style={summaryLabel}>Tax ({taxRate}%)</Text></Column>
          <Column style={{ textAlign: 'right' as const }}>
            <Text style={summaryValue}>+{fmt(taxAmount)}</Text>
            {showLocal && <Text style={localNote}>{localFmt(taxAmount)}</Text>}
          </Column>
        </Row>
      )}

      {processingFeeRate > 0 && processingFeeConverted > 0 && (
        <Row style={{ background: '#FAFAF8', padding: '2px 16px 8px' }}>
          <Column><Text style={summaryLabel}>Processing Fee ({(processingFeeRate * 100).toFixed(1)}%)</Text></Column>
          <Column style={{ textAlign: 'right' as const }}>
            <Text style={summaryValue}>+{fmt(processingFeeConverted)}</Text>
            {showLocal && <Text style={localNote}>{localFmt(processingFeeConverted)}</Text>}
          </Column>
        </Row>
      )}
    </Section>
  );
}

const headerCell: React.CSSProperties = {
  margin: 0,
  fontSize: '10px',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
};

const summaryLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
};

const summaryValue: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#1e293b',
  fontWeight: 500,
};

const localNote: React.CSSProperties = {
  margin: '1px 0 0',
  fontSize: '10px',
  color: '#94a3b8',
};
