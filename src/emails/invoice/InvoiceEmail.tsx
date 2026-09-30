// src/emails/invoice/InvoiceEmail.tsx
// Catalyst Tax Invoice Email
// Exact executive layout matching the gemini-svg.svg brand specification

import * as React from 'react';
import { Html, Head, Body, Container, Preview } from '@react-email/components';
import type { InvoiceData } from '@/types';
import { CatalystTaxInvoiceEmailCard } from './CatalystTaxInvoiceEmailCard';
import { formatCurrency } from '@/lib/pricing';

interface InvoiceEmailProps {
  invoice: InvoiceData;
  bankAccount?: any;
}

export function InvoiceEmail({ invoice, bankAccount }: InvoiceEmailProps) {
  const payUrl = invoice.razorpayLinkUrl || invoice.paypalPaymentUrl || '';
  const curSym = invoice.currencySymbol || invoice.currency;
  const fmt = (n: number) => formatCurrency(n, curSym);

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <style>{`
          @media only screen and (max-width: 640px) {
            .email-container { width: 100% !important; padding: 0 !important; }
            .mobile-pad { padding: 16px 12px !important; }
          }
        `}</style>
      </Head>
      <Preview>{`Tax Invoice ${invoice.invoiceNumber} for ${invoice.clientName} — ${fmt(invoice.totalPayable)}`}</Preview>
      <Body style={{ margin: 0, padding: '24px 0', backgroundColor: '#F9F9FB', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        <Container className="email-container" style={{ maxWidth: '660px', margin: '0 auto', padding: '0 12px' }}>
          <CatalystTaxInvoiceEmailCard
            invoice={invoice}
            isPaid={invoice.status === 'PAID'}
            payUrl={payUrl}
            bankAccount={bankAccount}
          />
        </Container>
      </Body>
    </Html>
  );
}
