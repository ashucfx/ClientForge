// src/emails/invoice/CheckoutRecoveryEmail.tsx
// Abandoned cart / checkout recovery. level 1-4 drives copy variation.

import * as React from 'react';
import { Section, Text, Button, Hr } from '@react-email/components';
import type { InvoiceData } from '@/types';
import { getBrand } from '@/lib/brand/registry';
import { formatCurrency } from '@/lib/pricing';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';
import { derivePackageLabel } from '@/lib/email';
import { EmailShell, EmailHeading, EmailBody, InfoBox } from '../shared/EmailShell';
import { LineItemTable } from '../shared/LineItemTable';
import { TotalBanner } from '../shared/TotalBanner';

interface CheckoutRecoveryEmailProps {
  invoice: InvoiceData;
  level: 1 | 2 | 3 | 4;
}

const LEVEL_COPY: Record<1 | 2 | 3 | 4, { headline: string; body: string; cta: string; urgency?: string }> = {
  1: {
    headline: 'You left something behind',
    body: "We noticed you started building your career package but didn't quite finish. Your selections are saved — pick up right where you left off.",
    cta: 'Complete My Purchase',
  },
  2: {
    headline: 'Your cart is still waiting',
    body: "Your career investment is still saved. Thousands of professionals have used this package to land better roles — you're one click away.",
    cta: 'Resume My Checkout',
  },
  3: {
    headline: "Don't miss your career boost",
    body: "This is your third reminder — your selected services are still reserved. Investing in your career is the highest-ROI decision you can make right now.",
    cta: 'Claim My Package Now',
    urgency: 'Limited reminder — this link may expire soon.',
  },
  4: {
    headline: 'Last chance — link expires soon',
    body: "This is your final reminder. After this, your checkout session will expire and prices may change. Complete your order now to lock in the current rate.",
    cta: 'Complete Order Before It Expires',
    urgency: '⚠️ This payment link expires soon.',
  },
};

export function CheckoutRecoveryEmail({ invoice, level }: CheckoutRecoveryEmailProps) {
  const brand     = getBrand(invoice.brandId);
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const items     = parseInvoiceLineItems(invoice.lineItems);
  const pkgLabel  = derivePackageLabel(items);
  const payUrl    = invoice.razorpayLinkUrl || invoice.paypalPaymentUrl || '';
  const copy      = LEVEL_COPY[level];

  return (
    <EmailShell
      preview={`${copy.headline} — your ${pkgLabel} is waiting, ${firstName}.`}
      brand={brand}
    >
      {/* Urgency badge for higher levels */}
      {level >= 3 && copy.urgency && (
        <Section style={{
          background: level === 4 ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${level === 4 ? '#fecaca' : '#fde68a'}`,
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '20px',
        }}>
          <Text style={{ margin: 0, fontSize: '13px', color: level === 4 ? '#991b1b' : '#92400e', fontWeight: 600 }}>
            {copy.urgency}
          </Text>
        </Section>
      )}

      <EmailHeading>{copy.headline}</EmailHeading>
      <EmailBody>
        Hi <strong>{firstName}</strong>, {copy.body}
      </EmailBody>

      {/* Cart summary */}
      <LineItemTable
        items={items}
        subtotal={invoice.subtotalConverted}
        discountRate={invoice.discountRate}
        discountAmount={invoice.discountAmount}
        taxRate={invoice.taxRate}
        taxAmount={invoice.taxAmount}
        processingFeeRate={invoice.processingFeeRate}
        processingFeeConverted={invoice.processingFeeConverted}
        sym={sym}
        brand={brand}
        fmt={fmt}
      />

      <TotalBanner
        label="Your Total"
        sublabel={`${invoice.currency} · incl. all fees`}
        amount={fmt(invoice.totalPayable)}
        brand={brand}
      />

      {/* CTA */}
      {payUrl && (
        <>
          <Section style={{ textAlign: 'center' as const, margin: '28px 0 12px' }}>
            <Button
              href={payUrl}
              style={{
                display: 'inline-block',
                background: `linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.primaryDark} 100%)`,
                color: '#ffffff',
                textDecoration: 'none',
                padding: '16px 48px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '0.3px',
              }}
            >
              {copy.cta}
            </Button>
          </Section>
          <Text style={{
            margin: '0 0 24px',
            fontSize: '11px',
            color: '#b0b8cc',
            textAlign: 'center' as const,
            wordBreak: 'break-all' as const,
          }}>
            Payment link:{' '}
            <a href={payUrl} style={{ color: brand.primaryColor }}>{payUrl}</a>
          </Text>
        </>
      )}

      {/* Show timeline and value props only on levels 1-2 */}
      {level <= 2 && (
        <>
          <Hr style={{ borderColor: '#EDE9DF', margin: '8px 0 20px' }} />
          {[
            { icon: '✍️', title: 'Expert crafting', desc: 'ATS-optimised documents by career specialists' },
            { icon: '⚡', title: '2–4 day delivery', desc: 'Fast turnaround without compromising quality' },
            { icon: '🔄', title: '2 free revisions', desc: "We refine until you're 100% satisfied" },
          ].map((item, idx) => (
            <table key={idx} role="presentation" cellPadding={0} cellSpacing={0} style={{ marginBottom: '12px', width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ width: '36px', verticalAlign: 'middle' as const, textAlign: 'center' as const, fontSize: '20px' }}>
                    {item.icon}
                  </td>
                  <td style={{ paddingLeft: '12px', verticalAlign: 'middle' as const }}>
                    <Text style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </Text>
                    <Text style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      {item.desc}
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
        </>
      )}

      <Hr style={{ borderColor: '#EDE9DF', margin: '20px 0 14px' }} />

      <InfoBox brand={brand}>
        Questions before you checkout?{' '}
        <a href={`mailto:${brand.replyTo}`} style={{ color: brand.primaryColor, fontWeight: 600 }}>
          {brand.replyTo}
        </a>
        {' '}— we reply within a few hours.
      </InfoBox>
    </EmailShell>
  );
}
