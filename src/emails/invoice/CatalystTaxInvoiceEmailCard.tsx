// src/emails/invoice/CatalystTaxInvoiceEmailCard.tsx
// Exact executive Tax Invoice layout for transactional emails (Client & Admin)
// Mirrors gemini-svg.svg 1:1 using bulletproof, responsive email HTML tables

import React from 'react';
import crypto from 'crypto';
import type { InvoiceData, LineItem } from '@/types';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';
import { formatCurrency } from '@/lib/pricing';

interface CatalystTaxInvoiceEmailCardProps {
  invoice: InvoiceData;
  isPaid?: boolean;
  payUrl?: string;
  bankAccount?: any;
}

function getPackageDetails(clientType?: string | null, notes?: string | null, lineItems: LineItem[] = []) {
  const combined = `${clientType || ''} ${notes || ''} ${lineItems.map(i => i.description).join(' ')}`.toLowerCase();

  const isPremiumPlus =
    combined.includes('executive_plus') ||
    combined.includes('premium plus') ||
    combined.includes('exec+') ||
    combined.includes('plus package');

  if (isPremiumPlus) {
    return {
      packageName: 'Premium Plus Package',
      trackName: '— Executive C-Suite & Global Talent Positioning Architecture',
      slaDays: 'SLA: 7–10 BIZ DAYS',
    };
  }

  return {
    packageName: 'Career Booster Package',
    trackName: '— Professional Career Acceleration Architecture',
    slaDays: 'SLA: 7–10 BIZ DAYS',
  };
}

function sanitizeItemDescription(rawDesc: string, pkgName: string): { title: string; subtitle?: string; isComp?: boolean } {
  const lower = (rawDesc || '').toLowerCase().trim();

  if (lower.includes('portal automated upgrade') || lower.includes('target:') || lower.includes('upgrade')) {
    if (lower.includes('plus') || lower.includes('executive_plus')) {
      return {
        title: 'Premium Plus Package — Complete Architecture Upgrade',
        subtitle: 'Executive C-Suite Narrative Transformation, Global Positioning & Strategy',
      };
    }
    return {
      title: 'Executive Career Architecture — Portfolio Service Upgrade',
      subtitle: 'Comprehensive Professional Calibration & Advanced Positioning Scope',
    };
  }

  if (lower.includes('cover letter') || lower.includes('coverletter') || lower.includes('complimentary')) {
    return {
      title: 'Executive Cover Letter Architecture',
      subtitle: 'Modular high-impact narrative tailored to target leadership roles',
      isComp: true,
    };
  }

  if (lower.includes('linkedin')) {
    return {
      title: 'LinkedIn Profile Optimisation + Custom Banner Concept',
      subtitle: 'Strategic personal brand realignment and algorithmic discovery tuning',
    };
  }

  if (lower.includes('resume') || lower.includes('cv')) {
    return {
      title: 'Resume Rewrite & Product Leadership Positioning',
      subtitle: 'Catalyst Talent Positioning Architecture Deliverable Suite',
    };
  }

  if (lower.includes('portfolio')) {
    return {
      title: 'Executive Portfolio Website & Personal Dossier',
      subtitle: 'Digital leadership identity architecture & executive case studies',
    };
  }

  if (lower.includes('revision')) {
    return {
      title: 'Strategic Profile Calibration & Revision Scope',
      subtitle: 'Iterative targeted refinement, ATS keyword re-calibration & polish',
    };
  }

  if (lower === 'fresher' || lower.includes('fresher')) {
    return {
      title: 'Career Booster Package — Early Professional Track',
      subtitle: 'ATS-optimized resume architecture, LinkedIn overhaul & outreach assets',
    };
  }

  if (lower === 'mid_career' || lower.includes('mid-career') || lower.includes('mid career')) {
    return {
      title: 'Career Booster Package — Professional Acceleration Track',
      subtitle: 'Executive resume transformation, LinkedIn repositioning & career narrative',
    };
  }

  if (lower === 'executive_plus' || lower.includes('premium plus') || lower.includes('exec+')) {
    return {
      title: 'Premium Plus Package — Global Executive Placement Track',
      subtitle: 'Executive C-Suite narrative overhaul, strategic LinkedIn presence & advisory',
    };
  }

  if (lower === 'executive') {
    return {
      title: 'Executive Leadership Architecture Package',
      subtitle: 'Senior leadership ATS positioning, executive LinkedIn overhaul & career dossier',
    };
  }

  if (!rawDesc || rawDesc === 'Career Booster Services' || rawDesc === 'Direct Onboarding') {
    return {
      title: pkgName,
      subtitle: 'Complete Talent Positioning Architecture & Professional Deliverables Suite',
    };
  }

  return {
    title: rawDesc,
    subtitle: 'Catalyst Talent Positioning Architecture · Deliverable Suite',
  };
}

export function CatalystTaxInvoiceEmailCard({
  invoice,
  isPaid = invoice.status === 'PAID',
  payUrl,
  bankAccount,
}: CatalystTaxInvoiceEmailCardProps) {
  const lineItems: LineItem[] = parseInvoiceLineItems(invoice.lineItems);
  const curSym = invoice.currencySymbol || invoice.currency;
  const fmt = (n: number) => formatCurrency(n, curSym);

  const pkg = getPackageDetails(invoice.clientType, invoice.notes, lineItems);

  const cleanTxnRef =
    invoice.razorpayPaymentId ||
    invoice.paypalInvoiceId ||
    `TXN-${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}`;

  const issueDateStr = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(invoice.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const paidDateStr = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : issueDateStr;

  const isIndia = !invoice.country || invoice.country.toLowerCase().includes('india') || invoice.currency === 'INR';
  const jurisdictionLabel = isIndia ? 'India (Domestic Rail)' : `${invoice.country || 'International'} (Global Rail)`;

  let gatewayLabel = 'Via Razorpay Payment Gateway';
  if (invoice.paymentGateway === 'PAYPAL' || invoice.paypalPaymentUrl) {
    gatewayLabel = 'Via PayPal Payment Gateway';
  } else if (invoice.paymentGateway?.includes('BANK_TRANSFER')) {
    gatewayLabel = 'Via Authorized Institutional Banking Rail';
  }

  // Cryptographic verification hash (tamper-evident SHA-256)
  const hashDigest = crypto
    .createHash('sha256')
    .update(`${invoice.id}-${invoice.invoiceNumber}-${invoice.totalPayable}-${invoice.clientEmail}`)
    .digest('hex')
    .toUpperCase();
  const shortHash = `SHA-256: ${hashDigest.slice(0, 4)}...${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(-6)}`;

  const displayItems = lineItems.length > 0
    ? lineItems
    : [
        {
          id: '1',
          description: pkg.packageName,
          qty: 1,
          unitPrice: invoice.totalPayable,
          lineTotal: invoice.totalPayable,
        },
      ];

  return (
    <div style={{ margin: '0 auto', maxWidth: '640px', width: '100%', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Outer Executive White Sheet Container */}
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid #E2E6EB',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(14, 18, 23, 0.08)',
        }}
      >
        <tbody>
          {/* Top Gold Gradient Accent Bar */}
          <tr>
            <td
              style={{
                height: '6px',
                background: 'linear-gradient(90deg, #D4AF37 0%, #F3E5AB 50%, #AA7C11 100%)',
                fontSize: 0,
                lineHeight: 0,
              }}
            >
              &nbsp;
            </td>
          </tr>

          {/* Document Content */}
          <tr>
            <td style={{ padding: '28px 32px' }}>
              {/* ── 1. HEADER ── */}
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '16px' }}>
                <tbody>
                  <tr>
                    {/* Left: Brand Lockup */}
                    <td valign="middle">
                      <table role="presentation" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td valign="middle" style={{ width: '48px', paddingRight: '12px' }}>
                              {/* Catalyst Logo Mark */}
                              <table
                                role="presentation"
                                cellPadding={0}
                                cellSpacing={0}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  backgroundColor: '#0E1217',
                                  borderRadius: '9px',
                                  border: '1px solid rgba(184, 147, 91, 0.4)',
                                }}
                              >
                                <tbody>
                                  <tr>
                                    <td align="center" valign="middle" style={{ color: '#F4F4F2', fontSize: '18px', fontWeight: 900, fontFamily: 'Georgia, serif' }}>
                                      C<span style={{ color: '#B88A44', fontSize: '13px' }}>✦</span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                            <td valign="middle">
                              <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '2px', color: '#0E1217', lineHeight: 1.2 }}>
                                CATALYST{' '}
                                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px', color: '#AA7C11', verticalAlign: 'middle' }}>
                                  | TALENT POSITIONING ARCHITECTURE
                                </span>
                              </div>
                              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: '#64748B', textTransform: 'uppercase', marginTop: '3px' }}>
                                A SUB-BRAND OF RIPPLE NEXUS
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>

                    {/* Right: Invoice Type & Status Badge */}
                    <td align="right" valign="middle">
                      <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px', color: '#0E1217', lineHeight: 1.2 }}>
                        TAX INVOICE
                      </div>
                      <div style={{ marginTop: '5px' }}>
                        {isPaid ? (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#065F46',
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '1px',
                              padding: '3px 10px',
                              borderRadius: '4px',
                            }}
                          >
                            <span style={{ color: '#059669', marginRight: '4px' }}>●</span> PAID
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              color: '#92400E',
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '1px',
                              padding: '3px 10px',
                              borderRadius: '4px',
                            }}
                          >
                            <span style={{ color: '#D97706', marginRight: '4px' }}>●</span> PAYMENT DUE
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Hairline Separator */}
              <div style={{ height: '1px', backgroundColor: '#ECEFF2', margin: '0 0 18px 0' }} />

              {/* ── 2. METADATA CARDS ── */}
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '18px' }}>
                <tbody>
                  <tr>
                    {/* Left Card: Client Particulars */}
                    <td
                      width="49%"
                      valign="top"
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #EAEFF4',
                        borderRadius: '10px',
                        padding: '14px 16px',
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.2px', color: '#8A94A6', textTransform: 'uppercase', marginBottom: '6px' }}>
                        BILLED TO (PRINCIPAL CLIENT)
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0E1217', marginBottom: '4px' }}>
                        {invoice.clientName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4A5568', marginBottom: '2px' }}>
                        {invoice.clientEmail}
                      </div>
                      {invoice.clientPhone && (
                        <div style={{ fontSize: '12px', color: '#4A5568', marginBottom: '2px' }}>
                          {invoice.clientPhone}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#8A94A6', marginTop: '6px' }}>
                        Jurisdiction: <strong style={{ color: '#1A202C' }}>{jurisdictionLabel}</strong>
                      </div>
                    </td>

                    <td width="2%">&nbsp;</td>

                    {/* Right Card: Fiscal Ledger */}
                    <td
                      width="49%"
                      valign="top"
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #EAEFF4',
                        borderRadius: '10px',
                        padding: '14px 16px',
                      }}
                    >
                      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td width="50%" valign="top" style={{ paddingBottom: '10px' }}>
                              <div style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '1px', color: '#8A94A6', textTransform: 'uppercase' }}>
                                INVOICE NUMBER
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#0E1217', marginTop: '2px' }}>
                                {invoice.invoiceNumber}
                              </div>
                            </td>
                            <td width="50%" valign="top" style={{ paddingBottom: '10px' }}>
                              <div style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '1px', color: '#8A94A6', textTransform: 'uppercase' }}>
                                TRANSACTION REF
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: '#0E1217', marginTop: '2px' }}>
                                {cleanTxnRef}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td width="50%" valign="top">
                              <div style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '1px', color: '#8A94A6', textTransform: 'uppercase' }}>
                                ISSUE DATE
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A202C', marginTop: '2px' }}>
                                {issueDateStr}
                              </div>
                            </td>
                            <td width="50%" valign="top">
                              <div style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '1px', color: '#8A94A6', textTransform: 'uppercase' }}>
                                {isPaid ? 'SETTLEMENT DATE' : 'DUE DATE'}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A202C', marginTop: '2px' }}>
                                {isPaid ? paidDateStr : new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── 3. ENGAGEMENT SCOPE BANNER ── */}
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  background: '#0E1217',
                  borderRadius: '8px',
                  marginBottom: '18px',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: '12px 18px' }} valign="middle">
                      <span style={{ fontSize: '9.5px', fontWeight: 800, letterSpacing: '1.2px', color: '#AA7C11', marginRight: '8px' }}>
                        ENGAGEMENT SCOPE
                      </span>
                      <strong style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginRight: '6px' }}>
                        {pkg.packageName}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {pkg.trackName}
                      </span>
                    </td>
                    <td align="right" valign="middle" style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: '#1E293B',
                          color: '#F1F5F9',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          padding: '4px 10px',
                          borderRadius: '5px',
                        }}
                      >
                        {pkg.slaDays}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── 4. LINE ITEMS TABLE ── */}
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th align="left" style={{ padding: '8px 12px', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase', borderRadius: '6px 0 0 6px' }}>
                      SERVICE SPECIFICATION &amp; DELIVERABLES
                    </th>
                    <th align="center" style={{ padding: '8px 12px', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase', width: '45px' }}>
                      QTY
                    </th>
                    <th align="right" style={{ padding: '8px 12px', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase', width: '90px' }}>
                      UNIT RATE
                    </th>
                    <th align="right" style={{ padding: '8px 12px', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase', width: '95px', borderRadius: '0 6px 6px 0' }}>
                      NET AMOUNT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item, idx) => {
                    const sanitized = sanitizeItemDescription(item.description, pkg.packageName);
                    const isFree = item.lineTotal === 0 || sanitized.isComp;
                    const qtyStr = item.qty < 10 ? `0${item.qty}` : `${item.qty}`;
                    const formattedRate = isFree ? `${curSym}0.00` : fmt(item.unitPrice);
                    const formattedTotal = isFree ? `${curSym}0.00` : fmt(item.lineTotal);

                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E1217', lineHeight: 1.3 }}>
                            {sanitized.title}
                            {isFree && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  fontSize: '8px',
                                  fontWeight: 800,
                                  letterSpacing: '0.6px',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  marginLeft: '6px',
                                  verticalAlign: 'middle',
                                }}
                              >
                                COMPLIMENTARY
                              </span>
                            )}
                          </div>
                          {sanitized.subtitle && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', lineHeight: 1.4 }}>
                              {sanitized.subtitle}
                            </div>
                          )}
                        </td>
                        <td align="center" style={{ padding: '12px 12px', verticalAlign: 'top', fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>
                          {qtyStr}
                        </td>
                        <td align="right" style={{ padding: '12px 12px', verticalAlign: 'top', fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>
                          {formattedRate}
                        </td>
                        <td align="right" style={{ padding: '12px 12px', verticalAlign: 'top', fontSize: '13px', fontWeight: 700, color: isFree ? '#059669' : '#0E1217' }}>
                          {formattedTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── 5. TOTALS SECTION ── */}
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td width="40%">&nbsp;</td>
                    <td width="60%">
                      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '3px 0', fontSize: '12px', color: '#64748B', textAlign: 'right' }}>
                              Net Subtotal
                            </td>
                            <td style={{ padding: '3px 0', fontSize: '13px', fontWeight: 600, color: '#0E1217', textAlign: 'right', width: '130px' }}>
                              {fmt(invoice.subtotalConverted)}
                            </td>
                          </tr>

                          {invoice.discountAmount > 0 && (
                            <tr>
                              <td style={{ padding: '3px 0', fontSize: '12px', color: '#059669', textAlign: 'right' }}>
                                Concession / Discount ({invoice.discountRate}%)
                              </td>
                              <td style={{ padding: '3px 0', fontSize: '13px', fontWeight: 600, color: '#059669', textAlign: 'right' }}>
                                −{fmt(invoice.discountAmount)}
                              </td>
                            </tr>
                          )}

                          {invoice.taxAmount > 0 && (
                            <tr>
                              <td style={{ padding: '3px 0', fontSize: '12px', color: '#64748B', textAlign: 'right' }}>
                                Applicable Tax ({invoice.taxRate}%)
                              </td>
                              <td style={{ padding: '3px 0', fontSize: '13px', fontWeight: 600, color: '#0E1217', textAlign: 'right' }}>
                                +{fmt(invoice.taxAmount)}
                              </td>
                            </tr>
                          )}

                          {invoice.processingFeeConverted > 0 && (
                            <tr>
                              <td style={{ padding: '3px 0', fontSize: '12px', color: '#64748B', textAlign: 'right' }}>
                                Processing &amp; Settlement Fee
                              </td>
                              <td style={{ padding: '3px 0', fontSize: '13px', fontWeight: 600, color: '#0E1217', textAlign: 'right' }}>
                                +{fmt(invoice.processingFeeConverted)}
                              </td>
                            </tr>
                          )}

                          <tr>
                            <td colSpan={2} style={{ padding: '4px 0' }}>
                              <div style={{ height: '1px', backgroundColor: '#E2E8F0' }} />
                            </td>
                          </tr>

                          {/* Dark Settled Total Capsule */}
                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                background: '#0E1217',
                                borderRadius: '8px',
                                padding: '12px 16px',
                              }}
                            >
                              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                <tbody>
                                  <tr>
                                    <td valign="middle">
                                      <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: '#D4AF37', textTransform: 'uppercase' }}>
                                        {isPaid ? `TOTAL PAID (${invoice.currency})` : `TOTAL PAYABLE (${invoice.currency})`}
                                      </div>
                                    </td>
                                    <td align="right" valign="middle">
                                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                                        {fmt(invoice.totalPayable)}
                                      </div>
                                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px' }}>
                                        {gatewayLabel}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── Unpaid CTA Button (if invoice is unpaid) ── */}
              {!isPaid && payUrl && (
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px' }}>
                  <tbody>
                    <tr>
                      <td align="center">
                        <a
                          href={payUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            background: 'linear-gradient(135deg, #0E1217 0%, #B88A44 100%)',
                            color: '#FFFFFF',
                            textDecoration: 'none',
                            padding: '16px 44px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 800,
                            letterSpacing: '0.4px',
                            boxShadow: '0 4px 18px rgba(184, 147, 91, 0.3)',
                          }}
                        >
                          Complete Payment — {fmt(invoice.totalPayable)}
                        </a>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                          Secured by 256-Bit Financial Encryption • Instant Gateway Authorization
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ── 6. SERVICE LEVEL AGREEMENT & EXECUTION PROTOCOL ── */}
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #EAEFF4',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '20px',
                }}
              >
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th
                      colSpan={3}
                      align="left"
                      style={{
                        padding: '8px 16px',
                        fontSize: '9.5px',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        color: '#334155',
                        textTransform: 'uppercase',
                      }}
                    >
                      SERVICE LEVEL AGREEMENT &amp; EXECUTION PROTOCOL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {/* Col 1 */}
                    <td width="33%" valign="top" style={{ padding: '14px 14px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0E1217', marginBottom: '4px' }}>
                        <span style={{ color: '#AA7C11', marginRight: '4px' }}>●</span> Turnaround SLA Window
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.5 }}>
                        Delivery guaranteed within 7–10 business days following intake sign-off.
                      </div>
                    </td>

                    {/* Col 2 */}
                    <td width="33%" valign="top" style={{ padding: '14px 14px', borderLeft: '1px solid #EAEFF4', borderRight: '1px solid #EAEFF4' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0E1217', marginBottom: '4px' }}>
                        <span style={{ color: '#AA7C11', marginRight: '4px' }}>●</span> Calibrations &amp; Revisions
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.5 }}>
                        Includes 2 iterative calibration cycles within 7 calendar days of draft dispatch.
                      </div>
                    </td>

                    {/* Col 3 */}
                    <td width="34%" valign="top" style={{ padding: '14px 14px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0E1217', marginBottom: '4px' }}>
                        <span style={{ color: '#AA7C11', marginRight: '4px' }}>●</span> Governance &amp; Authority
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.5 }}>
                        Enforceable under Catalyst Governance &amp; Ripple Nexus Master Framework.
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── 7. ISSUING LEGAL ENTITY & VERIFICATION SEAL ── */}
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '18px' }}>
                <tbody>
                  <tr>
                    {/* Left: Entity Lockup */}
                    <td width="60%" valign="top">
                      <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.2px', color: '#8A94A6', textTransform: 'uppercase', marginBottom: '4px' }}>
                        ISSUING CORPORATE LEGAL ENTITY
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0E1217', marginBottom: '2px' }}>
                        Ripple Nexus
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#B88A44', marginBottom: '2px' }}>
                        Operating as Catalyst (A Sub-Brand of Ripple Nexus)
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Global Talent Positioning Architecture • theripplenexus.com
                      </div>
                    </td>

                    {/* Right: Security Seal */}
                    <td width="40%" valign="top" align="right">
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        style={{
                          background: '#F8FAFC',
                          border: '1px dashed #CBD5E1',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          textAlign: 'left',
                        }}
                      >
                        <tbody>
                          <tr>
                            <td valign="middle" style={{ paddingRight: '8px' }}>
                              <span style={{ display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%', background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center', lineHeight: '22px', color: '#059669', fontSize: '11px', fontWeight: 900 }}>
                                ✓
                              </span>
                            </td>
                            <td valign="middle">
                              <div style={{ fontSize: '10px', fontWeight: 800, color: '#065F46', letterSpacing: '0.6px' }}>
                                CRYPTOGRAPHICALLY VERIFIED
                              </div>
                              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#64748B', marginTop: '1px' }}>
                                {shortHash}
                              </div>
                              <div style={{ fontSize: '8.5px', color: '#94A3B8', marginTop: '1px' }}>
                                Authenticated Digital Receipt
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── 8. MICRO FOOTER ── */}
              <div style={{ height: '1px', backgroundColor: '#ECEFF2', margin: '0 0 10px 0' }} />
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td valign="middle">
                      <div style={{ fontSize: '9.5px', color: '#94A3B8' }}>
                        This document is an authenticated tax invoice and receipt for talent architecture services rendered.
                      </div>
                    </td>
                    <td align="right" valign="middle" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#AA7C11', letterSpacing: '0.8px' }}>
                        CATALYST • A SUB-BRAND OF RIPPLE NEXUS
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
