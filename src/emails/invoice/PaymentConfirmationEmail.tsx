// src/emails/invoice/PaymentConfirmationEmail.tsx

import * as React from 'react';
import { Section, Text, Hr } from '@react-email/components';
import type { InvoiceData } from '@/types';
import { getBrand } from '@/lib/brand/registry';
import { formatCurrency } from '@/lib/pricing';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';
import { derivePackageLabel } from '@/lib/email';
import {
  EmailShell, EmailHeading, EmailBody, InfoBox,
} from '../shared/EmailShell';
import { MetaGrid } from '../shared/MetaGrid';

interface PaymentConfirmationEmailProps {
  invoice: InvoiceData;
}

export function PaymentConfirmationEmail({ invoice }: PaymentConfirmationEmailProps) {
  const brand     = getBrand(invoice.brandId);
  const sym       = invoice.currencySymbol;
  const fmt       = (n: number) => formatCurrency(n, sym);
  const firstName = invoice.clientName.split(' ')[0];
  const items     = parseInvoiceLineItems(invoice.lineItems);
  const pkgLabel  = derivePackageLabel(items);
  const paidOnStr = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <EmailShell
      preview={`Payment received! Your ${brand.id === 'catalyst' ? 'CareerPilot Package' : 'Project'} is now active. Work begins within 24 hours.`}
      brand={brand}
    >
      {/* Hero success heading */}
      <Section style={{
        textAlign: 'center' as const,
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        borderRadius: '12px',
        padding: '28px 24px',
        border: '1px solid #bbf7d0',
        marginBottom: '28px',
      }}>
        <div style={{ fontSize: '40px', lineHeight: '1', marginBottom: '12px' }}>✅</div>
        <EmailHeading style={{ textAlign: 'center' as const, color: '#14532d', margin: '0 0 8px' }}>
          Payment Confirmed!
        </EmailHeading>
        <Text style={{ margin: 0, fontSize: '15px', color: '#166534', lineHeight: '1.6', textAlign: 'center' as const }}>
          Thank you, <strong>{firstName}</strong>.{' '}
          Your {brand.id === 'catalyst' ? 'CareerPilot Package' : 'Project'} is now active
          and our team is ready to get to work.
        </Text>
      </Section>

      {/* Payment summary */}
      <MetaGrid
        brand={brand}
        cells={[
          { label: 'Invoice', value: invoice.invoiceNumber },
          { label: 'Amount Paid', value: `${fmt(invoice.totalPayable)} ${invoice.currency}`, highlight: true },
          { label: 'Package', value: pkgLabel, highlight: true },
          { label: 'Paid On', value: paidOnStr },
        ]}
      />

      {/* What's next numbered list */}
      <EmailBody style={{ marginTop: '24px', marginBottom: '16px' }}>
        <strong style={{ color: '#0f172a' }}>Here&apos;s what happens next:</strong>
      </EmailBody>

      {[
        {
          title: 'Our team begins work within 24 hours',
          desc: "We'll review your details and get started right away.",
        },
        {
          title: 'Delivery within 2–4 business days',
          desc: "You'll receive your deliverables via email and client portal.",
        },
        {
          title: '2 rounds of revisions included',
          desc: "We'll refine until you're completely satisfied.",
        },
      ].map((step, idx) => (
        <table
          key={idx}
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ marginBottom: '14px', width: '100%' }}
        >
          <tbody>
            <tr>
              <td style={{ width: '32px', verticalAlign: 'top' as const, paddingTop: '2px' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  background: brand.primaryLight,
                  borderRadius: '50%',
                  textAlign: 'center' as const,
                  lineHeight: '26px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: brand.primaryColor,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                }}>
                  {idx + 1}
                </div>
              </td>
              <td style={{ paddingLeft: '10px', verticalAlign: 'top' as const }}>
                <Text style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {step.title}
                </Text>
                <Text style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  {step.desc}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      <Hr style={{ borderColor: '#EDE9DF', margin: '24px 0' }} />

      {/* Contact callout */}
      <InfoBox brand={brand}>
        Questions or need to share additional information? Reply directly to this email or reach us at{' '}
        <a href={`mailto:${brand.replyTo}`} style={{ color: brand.primaryColor, fontWeight: 600 }}>
          {brand.replyTo}
        </a>
      </InfoBox>
    </EmailShell>
  );
}
