// src/emails/invoice/AdminPaymentAlertEmail.tsx
// Compact admin payment-received alert.

import * as React from 'react';
import { Section, Text, Button } from '@react-email/components';
import { getBrand } from '@/lib/brand/registry';
import { EmailShell } from '../shared/EmailShell';

interface AdminPaymentAlertEmailProps {
  clientName: string;
  clientEmail: string;
  product: string;
  amount: number;
  currency: string;
  currencySymbol: string;
  formattedAmount: string;
  paidAt: string;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  invoiceNumber?: string | null;
  adminUrl?: string | null;
  brandId?: string;
}

export function AdminPaymentAlertEmail({
  clientName,
  clientEmail,
  product,
  amount,
  currency,
  formattedAmount,
  paidAt,
  razorpayPaymentId,
  razorpayOrderId,
  invoiceNumber,
  adminUrl,
  brandId = 'catalyst',
}: AdminPaymentAlertEmailProps) {
  const brand = getBrand(brandId);

  const rows: { label: string; value: string; mono?: boolean; highlight?: boolean }[] = [
    { label: 'Client', value: clientName },
    { label: 'Email', value: clientEmail, mono: true },
    { label: 'Product', value: product, highlight: true },
    { label: 'Amount', value: `${formattedAmount} ${currency}`, highlight: true },
    { label: 'Paid At', value: `${paidAt} IST` },
    ...(invoiceNumber ? [{ label: 'Invoice', value: invoiceNumber, mono: true }] : []),
    ...(razorpayPaymentId ? [{ label: 'Payment ID', value: razorpayPaymentId, mono: true }] : []),
    ...(razorpayOrderId ? [{ label: 'Order ID', value: razorpayOrderId, mono: true }] : []),
  ];

  return (
    <EmailShell
      preview={`💰 Payment received — ${product} — ${formattedAmount} — ${clientEmail}`}
      brand={brand}
      headerBadge={{ label: 'Payment Received', value: formattedAmount, sub: currency }}
    >
      <Text style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
        New payment received
      </Text>

      {/* Data table */}
      <Section style={{ margin: '0 0 24px', borderRadius: '10px', border: '1px solid #EDE9DF', overflow: 'hidden' }}>
        {rows.map((row, idx) => (
          <table
            key={idx}
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            style={{
              width: '100%',
              borderBottom: idx < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <tbody>
              <tr>
                <td style={{
                  width: '130px',
                  padding: '10px 16px',
                  fontSize: '12px',
                  color: '#64748b',
                  whiteSpace: 'nowrap' as const,
                  verticalAlign: 'middle' as const,
                  background: '#FAFAF8',
                }}>
                  {row.label}
                </td>
                <td style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: row.highlight ? 700 : 500,
                  color: row.highlight ? brand.primaryColor : '#1e293b',
                  fontFamily: row.mono ? 'monospace' : undefined,
                  verticalAlign: 'middle' as const,
                }}>
                  {row.value}
                </td>
              </tr>
            </tbody>
          </table>
        ))}
      </Section>

      {adminUrl && (
        <Section style={{ textAlign: 'center' as const }}>
          <Button
            href={adminUrl}
            style={{
              display: 'inline-block',
              padding: '11px 28px',
              background: brand.primaryColor,
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            View Client →
          </Button>
        </Section>
      )}
    </EmailShell>
  );
}
