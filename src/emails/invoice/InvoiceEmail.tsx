// src/emails/invoice/InvoiceEmail.tsx

import * as React from 'react';
import { Section, Text, Button, Hr } from '@react-email/components';
import type { InvoiceData } from '@/types';
import { getBrand } from '@/lib/brand/registry';
import { formatCurrency, round2 } from '@/lib/pricing';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';
import { derivePackageLabel } from '@/lib/email';
import {
  EmailShell, EmailHeading, EmailSubheading, EmailBody, InfoBox, StatusPill,
} from '../shared/EmailShell';
import { LineItemTable } from '../shared/LineItemTable';
import { MetaGrid } from '../shared/MetaGrid';
import { TotalBanner } from '../shared/TotalBanner';
import { TimelineSteps } from '../shared/TimelineSteps';

interface InvoiceEmailProps {
  invoice: InvoiceData;
}

export function InvoiceEmail({ invoice }: InvoiceEmailProps) {
  const brand      = getBrand(invoice.brandId);
  const sym        = invoice.currencySymbol;
  const fmt        = (n: number) => formatCurrency(n, sym);
  const firstName  = invoice.clientName.split(' ')[0];
  const items      = parseInvoiceLineItems(invoice.lineItems);
  const pkgLabel   = derivePackageLabel(items);
  const payUrl     = invoice.razorpayLinkUrl || invoice.paypalPaymentUrl || '';
  const isPayPal   = !invoice.razorpayLinkUrl && !!invoice.paypalPaymentUrl;

  const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <EmailShell
      preview={`Hi ${firstName}, your ${pkgLabel} invoice for ${fmt(invoice.totalPayable)} is ready.`}
      brand={brand}
      headerBadge={{ label: 'Invoice', value: invoice.invoiceNumber, sub: invoiceDateStr }}
    >
      {/* Greeting */}
      <EmailHeading>Hello, {firstName},</EmailHeading>
      <EmailBody>
        Your <strong style={{ color: brand.primaryColor }}>{pkgLabel}</strong> invoice is ready.
        Review the details below and click <strong>Pay Now</strong>.
      </EmailBody>

      {/* Invoice meta */}
      <EmailSubheading>Invoice Details</EmailSubheading>
      <MetaGrid
        brand={brand}
        cells={[
          { label: 'Billed To', value: invoice.clientName },
          { label: 'Package', value: pkgLabel, highlight: true },
          { label: 'Issue Date', value: invoiceDateStr },
          { label: 'Due Date', value: dueDateStr, danger: true },
          { label: 'Email', value: invoice.clientEmail },
          { label: 'Country', value: invoice.country },
        ]}
      />

      {/* Services */}
      <EmailSubheading>Services Included</EmailSubheading>
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

      {/* Total */}
      <TotalBanner
        label="Total Payable"
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
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '0.3px',
              }}
            >
              Pay Now — {fmt(invoice.totalPayable)}
            </Button>
          </Section>
          <Text style={{
            margin: '0 0 4px',
            fontSize: '12px',
            color: '#94a3b8',
            textAlign: 'center' as const,
          }}>
            {isPayPal
              ? 'Secure payment via PayPal — Cards · PayPal Balance · Bank Transfer'
              : 'Secure payment via Razorpay — UPI · Cards · Net Banking · Wallets'}
          </Text>
          <Text style={{
            margin: '0 0 28px',
            fontSize: '11px',
            color: '#b0b8cc',
            textAlign: 'center' as const,
            wordBreak: 'break-all' as const,
          }}>
            Or copy this link:{' '}
            <a href={payUrl} style={{ color: brand.primaryColor }}>{payUrl}</a>
          </Text>
        </>
      )}

      {/* Timeline */}
      <Hr style={{ borderColor: '#EDE9DF', margin: '0 0 24px' }} />
      <TimelineSteps
        brand={brand}
        steps={[
          { icon: '💳', title: 'Payment', desc: 'Instant confirmation via Razorpay or PayPal' },
          { icon: '✍️', title: 'Kickoff', desc: 'We review & begin your project within 24 hrs' },
          { icon: '🚀', title: 'Delivery', desc: 'Documents delivered in 2–4 business days' },
        ]}
      />

      {/* Testimonial — Catalyst only */}
      {brand.id === 'catalyst' && (
        <InfoBox brand={brand}>
          <em style={{ fontFamily: `"Playfair Display", Georgia, serif`, fontSize: '14px', color: '#065f46', lineHeight: '1.7' }}>
            &ldquo;A strategic investment in your career trajectory — crafted to maximise recruiter
            visibility, increase interview conversion, and give you the competitive edge you deserve.&rdquo;
          </em>
          <br />
          <strong style={{ fontSize: '11px', color: brand.primaryColor, letterSpacing: '0.5px' }}>
            — THE CATALYST TEAM
          </strong>
        </InfoBox>
      )}

      {/* Trust badges */}
      <Section style={{ margin: '20px 0 0' }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              {[
                { label: 'Secure Payment', sub: '256-bit SSL', icon: 'SSL' },
                { label: 'Fast Delivery', sub: '2–4 Business Days', icon: '2–4' },
                { label: '2 Revisions', sub: 'Satisfaction Driven', icon: '×2' },
              ].map((badge, i) => (
                <td key={i} style={{ width: '33%', textAlign: 'center' as const, padding: '0 4px' }}>
                  <div style={{
                    width: '32px', height: '32px',
                    background: brand.primaryLight,
                    borderRadius: '50%',
                    margin: '0 auto 6px',
                    lineHeight: '32px',
                    textAlign: 'center' as const,
                    fontSize: '10px',
                    fontWeight: 700,
                    color: brand.primaryColor,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                  }}>
                    {badge.icon}
                  </div>
                  <Text style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 700, color: '#0f172a', textAlign: 'center' as const }}>
                    {badge.label}
                  </Text>
                  <Text style={{ margin: 0, fontSize: '11px', color: '#94a3b8', textAlign: 'center' as const }}>
                    {badge.sub}
                  </Text>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Terms */}
      <Hr style={{ borderColor: '#EDE9DF', margin: '20px 0 14px' }} />
      <Text style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.8' }}>
        <strong style={{ color: '#64748b' }}>Terms & Conditions:</strong>{' '}
        No refunds after work commences · Delivery within 2–4 business days ·
        2 revisions included; additional revisions chargeable ·
        No job placement guarantee · All data kept strictly confidential.
      </Text>
    </EmailShell>
  );
}
