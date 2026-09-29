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

// ── Tier-specific content helpers ────────────────────────────────────────────

function tierIntroNode(
  clientType: InvoiceData['clientType'],
  pkgLabel: string,
  brandColor: string,
): React.ReactNode {
  const pkg = <strong style={{ color: brandColor }}>{pkgLabel}</strong>;
  switch (clientType) {
    case 'FRESHER':
      return <>Your {pkg} invoice is ready. Every expert was once a beginner — this is your launchpad to a professional presence that opens real doors.</>;
    case 'MID_CAREER':
      return <>Your {pkg} invoice is ready. We&rsquo;re set to sharpen your narrative, quantify your impact, and position you for the roles your experience truly commands.</>;
    case 'EXECUTIVE':
      return <>Your {pkg} invoice is ready. This marks the beginning of an executive-grade personal brand built to command search firm attention, open senior doors, and reflect the calibre of leadership you bring.</>;
    case 'EXECUTIVE_PLUS':
      return <>Your <strong style={{ color: brandColor }}>Premium Plus</strong> engagement is confirmed. This is a bespoke, white-glove collaboration reserved for leaders at the pinnacle of their career — crafted to speak to boards, investors, and the world&rsquo;s most discerning executive search firms.</>;
    default:
      return <>Your {pkg} invoice is ready. Review the details below and complete your payment to get started.</>;
  }
}

function tierQuote(clientType: InvoiceData['clientType']): string {
  switch (clientType) {
    case 'FRESHER':        return "Every exceptional career starts with a first impression that opens doors. We'll make sure yours counts.";
    case 'MID_CAREER':    return "Your experience is the asset. Our role is to help the market see its full value — and open the doors to the opportunities you've earned.";
    case 'EXECUTIVE':     return "Executive presence is built, not inherited. A strategic personal brand is the single highest-leverage investment a senior leader can make.";
    case 'EXECUTIVE_PLUS': return "For professionals at the top of their field, every word is a strategic asset. Your Premium Plus suite speaks directly to boards, investors, and the most discerning search firms worldwide.";
    default:              return "A strategic investment in your career trajectory — crafted to maximise recruiter visibility, increase interview conversion, and give you the competitive edge you deserve.";
  }
}

function tierBadge(clientType: InvoiceData['clientType']): string | null {
  if (clientType === 'EXECUTIVE')      return 'EXECUTIVE CLIENT';
  if (clientType === 'EXECUTIVE_PLUS') return 'PREMIUM PLUS · EXCLUSIVE';
  return null;
}

function tierDelivery(clientType: InvoiceData['clientType']): string {
  if (clientType === 'EXECUTIVE_PLUS') return 'Bespoke draft in 3–5 business days — unlimited revisions, white-glove service';
  if (clientType === 'EXECUTIVE')      return 'Initial draft in 2–4 business days — multiple revision rounds, premium care';
  return 'Initial draft in 2–4 business days — revisions included';
}

function tierRevisions(clientType: InvoiceData['clientType']): { label: string; sub: string } {
  if (clientType === 'EXECUTIVE_PLUS') return { label: 'Unlimited Revisions', sub: 'White-Glove Service' };
  if (clientType === 'EXECUTIVE')      return { label: '3 Revisions',         sub: 'Premium Care' };
  return { label: '2 Revisions', sub: 'Satisfaction Driven' };
}

// ─────────────────────────────────────────────────────────────────────────────

interface InvoiceEmailProps {
  invoice: InvoiceData;
  bankAccount?: any;
}

export function InvoiceEmail({ invoice, bankAccount }: InvoiceEmailProps) {
  const brand      = getBrand(invoice.brandId);
  const sym        = invoice.currencySymbol;
  const fmt        = (n: number) => formatCurrency(n, sym);
  const firstName  = invoice.clientName.split(' ')[0];
  const items      = parseInvoiceLineItems(invoice.lineItems);
  const pkgLabel   = derivePackageLabel(items);
  const payUrl        = invoice.razorpayLinkUrl || invoice.paypalPaymentUrl || '';
  const isPayPal      = !invoice.razorpayLinkUrl && !!invoice.paypalPaymentUrl;
  const tierBadgeText = tierBadge(invoice.clientType);
  const revBadge      = tierRevisions(invoice.clientType);

  // When PayPal converts an unsupported currency to USD, derive the USD→local rate
  // from the stored totals so each line item can show a local currency equivalent.
  const usdToLocalRate =
    isPayPal && invoice.localCurrencyCode && invoice.localEquivalentAmount != null && invoice.totalPayable > 0
      ? invoice.localEquivalentAmount / invoice.totalPayable
      : undefined;

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
      <EmailHeading>Hello, {firstName}</EmailHeading>
      {tierBadgeText && (
        <Section style={{ margin: '-4px 0 14px' }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(184,147,91,.10)',
            border: '1px solid rgba(184,147,91,.30)',
            color: '#9A7540',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1.8px',
            textTransform: 'uppercase' as const,
            padding: '4px 14px',
            borderRadius: '20px',
          }}>
            {tierBadgeText}
          </span>
        </Section>
      )}
      <EmailBody>
        {tierIntroNode(invoice.clientType, pkgLabel, brand.primaryColor)}
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
        localCurrencyCode={invoice.localCurrencyCode ?? undefined}
        usdToLocalRate={usdToLocalRate}
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
              : invoice.currency !== 'INR'
                ? `Secure payment via Razorpay — Cards · Bank Transfer · Wallets · charged in ${invoice.currency}`
                : 'Secure payment via Razorpay — UPI · Cards · Net Banking · Wallets'}
          </Text>
          {/* Local currency note — shown when PayPal fell back from unsupported currency to USD */}
          {isPayPal && invoice.localCurrencyCode && invoice.localEquivalentAmount != null && (
            <Section style={{ background: '#fffbeb', border: '1px solid #fbbf2460', borderRadius: '8px', padding: '10px 16px', margin: '6px 0 8px' }}>
              <Text style={{ margin: 0, fontSize: '12px', color: '#92400e', textAlign: 'center' as const, lineHeight: '1.7' }}>
                💱 PayPal charges in <strong>USD</strong> — your local equivalent is approximately{' '}
                <strong style={{ color: '#78350f' }}>
                  {invoice.localCurrencyCode} {invoice.localEquivalentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>.
                {' '}Individual breakdowns in {invoice.localCurrencyCode} are shown next to each item above.
              </Text>
            </Section>
          )}
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

      {/* Bank Transfer Instructions */}
      {bankAccount && (() => {
        const isSwift = invoice.paymentGateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT' || (Boolean(bankAccount.swiftBic) && !bankAccount.transferRail?.includes('ACH') && !bankAccount.transferRail?.includes('FPS'));
        return (
          <Section style={{ background: '#f8fafc', padding: '22px', borderRadius: '12px', border: '1.5px solid #cbd5e1', margin: '0 0 24px' }}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td>
                    <Text style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f1c3d' }}>
                      {isSwift ? '🌐 Global SWIFT Wire Transfer' : '🏦 Local Bank Transfer'} Instructions
                    </Text>
                  </td>
                  {bankAccount.transferRail && (
                    <td align="right">
                      <span style={{
                        display: 'inline-block',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        border: '1px solid #bae6fd',
                      }}>
                        {bankAccount.transferRail}
                      </span>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>

            <Text style={{ margin: '0 0 16px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
              Please transfer <strong>{fmt(invoice.totalPayable)} {invoice.currency}</strong> to the verified business account below.{' '}
              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                Important: Quote your invoice number ({invoice.invoiceNumber}) in the wire reference / memo field.
              </span>
            </Text>

            <table width="100%" cellPadding="0" cellSpacing="0" style={{ fontSize: '13px', color: '#334155' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>Account Name:</td>
                  <td align="right" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a' }}>{bankAccount.accountName}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>Bank Name:</td>
                  <td align="right" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{bankAccount.bankName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                    {bankAccount.iban ? 'IBAN / Account Number:' : 'Account Number:'}
                  </td>
                  <td align="right" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    {bankAccount.accountNumber || bankAccount.iban || 'N/A'}
                  </td>
                </tr>
                {(bankAccount.routingNumber || bankAccount.sortCode) && (
                  <tr>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                      {bankAccount.routingType ? `${bankAccount.routingType}:` : 'Routing / Sort Code:'}
                    </td>
                    <td align="right" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 700 }}>
                      {bankAccount.routingNumber || bankAccount.sortCode}
                    </td>
                  </tr>
                )}
                {bankAccount.swiftBic && (
                  <tr style={{ background: '#f0f9ff' }}>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                      SWIFT / BIC Code:
                    </td>
                    <td align="right" style={{ padding: '8px 6px', borderBottom: '1px solid #e0f2fe', fontFamily: 'monospace', fontWeight: 800, fontSize: '14px', color: '#0284c7' }}>
                      {bankAccount.swiftBic}
                    </td>
                  </tr>
                )}
                {bankAccount.bankAddress && (
                  <tr>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b', verticalAlign: 'top' }}>Bank Address:</td>
                    <td align="right" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b', maxWidth: '240px', lineHeight: '1.4' }}>
                      {bankAccount.bankAddress}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {bankAccount.paymentInstructions && (
              <Section style={{ margin: '14px 0 0', padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <Text style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>
                  <strong>Notes:</strong> {bankAccount.paymentInstructions}
                </Text>
              </Section>
            )}
          </Section>
        );
      })()}

      <Hr style={{ borderColor: '#EDE9DF', margin: '0 0 24px' }} />
      <TimelineSteps
        brand={brand}
        steps={[
          {
            icon: bankAccount ? '🏦' : '💳',
            title: 'Payment',
            desc: bankAccount
              ? `Wire reference ${invoice.invoiceNumber} — instant verification`
              : 'Instant confirmation via Razorpay or PayPal',
          },
          { icon: '✍️', title: 'Kickoff', desc: 'We review & begin your project within 24 hrs' },
          { icon: '🚀', title: 'Delivery', desc: tierDelivery(invoice.clientType) },
        ]}
      />

      {/* Quote — Catalyst brand only */}
      {brand.id === 'catalyst' && (
        <InfoBox brand={brand}>
          <em style={{ fontFamily: `"Playfair Display", Georgia, serif`, fontSize: '14px', color: '#065f46', lineHeight: '1.7' }}>
            &ldquo;{tierQuote(invoice.clientType)}&rdquo;
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
                { label: revBadge.label, sub: revBadge.sub, icon: '×2' },
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
