// src/lib/pdf/CatalystPaidInvoicePdf.tsx
// Official Catalyst Paid Tax Invoice & Receipt Generator
// Built with @react-pdf/renderer adhering to Catalyst Signal Gold & Obsidian guidelines

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import type { InvoiceData, LineItem } from '@/types';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';

// ── Executive Palette Tokens ──────────────────────────────────────────────────
const COLORS = {
  obsidian: '#0A0B0D',
  obsidianLight: '#14161B',
  gold: '#B8935B',
  goldDark: '#8C6933',
  goldLight: '#FAF6EE',
  goldBorder: '#D8C7A5',
  bone: '#FAF9F6',
  slateDark: '#0F172A',
  slateBody: '#334155',
  slateMuted: '#64748B',
  slateLight: '#F1F5F9',
  border: '#E2E8F0',
  emerald: '#059669',
  emeraldLight: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontSize: 8,
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
    color: COLORS.slateBody,
  },
  // ── Header Bar ──
  headerBar: {
    backgroundColor: COLORS.obsidian,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
    borderTopWidth: 2.5,
    borderTopColor: COLORS.gold,
    borderBottomWidth: 1,
    borderBottomColor: '#262930',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 5,
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 12.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  brandOrg: {
    fontSize: 6.5,
    color: '#94A3B8',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  receiptBadgeContainer: {
    alignItems: 'flex-end',
  },
  paidBadge: {
    backgroundColor: COLORS.emeraldLight,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRadius: 5,
    marginBottom: 3,
  },
  paidBadgeText: {
    color: COLORS.emerald,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  receiptTitle: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Purchased Package Spotlight Banner ──
  packageBanner: {
    backgroundColor: COLORS.goldLight,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageTag: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  packageName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    letterSpacing: 0.2,
  },
  packageSubtitle: {
    fontSize: 7.2,
    color: COLORS.slateBody,
    marginTop: 1.5,
  },
  packageRight: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    borderWidth: 0.8,
    borderColor: COLORS.goldBorder,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  slaTag: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slaValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    marginTop: 1,
  },

  // ── Two Column Meta Section ──
  gridTwoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  infoCardLeft: {
    width: '49%',
    backgroundColor: COLORS.bone,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    padding: 8,
  },
  infoCardRight: {
    width: '49%',
    backgroundColor: COLORS.bone,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    padding: 8,
  },
  cardTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8DEC8',
    paddingBottom: 2.5,
  },
  cardLineBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    marginBottom: 2.5,
  },
  cardLine: {
    fontSize: 7.6,
    color: COLORS.slateBody,
    marginBottom: 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EBEFF5',
  },
  metaLabel: {
    fontSize: 7.5,
    color: COLORS.slateMuted,
  },
  metaValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateDark,
  },

  // ── Table Container ──
  tableContainer: {
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 9,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.obsidian,
    paddingVertical: 5.5,
    paddingHorizontal: 8,
  },
  thDesc: { flex: 4.5, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 0.5 },
  thQty:  { flex: 0.8, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7, textAlign: 'center', letterSpacing: 0.5 },
  thPrice:{ flex: 1.6, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7, textAlign: 'right', letterSpacing: 0.5 },
  thTotal:{ flex: 1.6, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7, textAlign: 'right', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bone,
    alignItems: 'center',
  },
  tdDesc: { flex: 4.5 },
  tdDescMain: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.slateDark },
  tdDescSub: { fontSize: 6.8, color: COLORS.slateMuted, marginTop: 1 },
  tdQty:  { flex: 0.8, fontSize: 7.8, textAlign: 'center', color: COLORS.slateDark },
  tdPrice:{ flex: 1.6, fontSize: 7.8, textAlign: 'right', color: COLORS.slateDark },
  tdTotal:{ flex: 1.6, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: COLORS.obsidian },

  // ── Financial Summary ──
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 9,
  },
  summaryBox: {
    width: 220,
    backgroundColor: COLORS.bone,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    padding: 7,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 7.6,
    color: COLORS.slateMuted,
  },
  summaryVal: {
    fontSize: 7.6,
    color: COLORS.slateDark,
    fontFamily: 'Helvetica-Bold',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4.5,
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
  },
  totalLabel: {
    fontSize: 8.8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  totalVal: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
  },

  // ── SLA & Governance Box ──
  slaSection: {
    backgroundColor: COLORS.white,
    borderWidth: 0.8,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
    marginBottom: 9,
  },
  slaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 3,
  },
  slaHeading: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  slaAssentBadge: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.emerald,
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  slaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slaPillar: {
    width: '32%',
    backgroundColor: COLORS.bone,
    borderRadius: 4,
    padding: 5,
    borderWidth: 0.5,
    borderColor: '#E8DEC8',
  },
  pillarTitle: {
    fontSize: 6.6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  pillarBody: {
    fontSize: 6.5,
    color: COLORS.slateBody,
    lineHeight: 1.3,
  },

  // ── Institutional Footer ──
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    textAlign: 'center',
  },
  footerMain: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateDark,
  },
  footerSub: {
    fontSize: 6,
    color: COLORS.slateMuted,
    marginTop: 1.5,
    lineHeight: 1.3,
  },
});

// ── Package Categorization Helper ─────────────────────────────────────────────
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
      trackName: 'Executive C-Suite & Global Talent Positioning Architecture',
      scopePill: 'PREMIUM PLUS ARCHITECTURE',
      deliverables: 'Executive ATS Resume · LinkedIn C-Suite Architecture · Strategic Narrative Dossier · Global Advisory',
      slaDays: '7–10 Business Days',
    };
  }

  return {
    packageName: 'Career Booster Package',
    trackName: 'Professional Career Acceleration & Positioning Architecture',
    scopePill: 'CAREER BOOSTER ARCHITECTURE',
    deliverables: 'ATS-Proof Resume Architecture · LinkedIn Strategic Overhaul · Executive Pitch & Narrative Suite',
    slaDays: '7–10 Business Days',
  };
}

// ── Clean Line Item Description Sanitizer (Strictly No Internal Leaks) ────────
function sanitizeItemDescription(rawDesc: string, pkgName: string): { title: string; subtitle?: string } {
  const lower = (rawDesc || '').toLowerCase().trim();

  // Strip internal database / automated strings
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

  if (lower.includes('revision')) {
    return {
      title: 'Strategic Profile Calibration & Revision Scope',
      subtitle: 'Iterative Targeted Refinement, ATS Keyword Re-calibration & Polish',
    };
  }

  if (lower === 'fresher' || lower.includes('fresher')) {
    return {
      title: 'Career Booster Package — Early Professional Track',
      subtitle: 'ATS-Optimized Resume Architecture, LinkedIn Strategic Overhaul & Outreach Assets',
    };
  }

  if (lower === 'mid_career' || lower.includes('mid-career') || lower.includes('mid career')) {
    return {
      title: 'Career Booster Package — Professional Acceleration Track',
      subtitle: 'Executive Resume Transformation, LinkedIn Repositioning & Career Narrative Strategy',
    };
  }

  if (lower === 'executive_plus' || lower.includes('premium plus') || lower.includes('exec+')) {
    return {
      title: 'Premium Plus Package — Global Executive Placement Track',
      subtitle: 'Executive C-Suite Narrative Overhaul, Strategic LinkedIn Presence & Advisory',
    };
  }

  if (lower === 'executive') {
    return {
      title: 'Executive Leadership Architecture Package',
      subtitle: 'Senior Leadership ATS Positioning, Executive LinkedIn Overhaul & Career Dossier',
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

export function CatalystPaidInvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  const lineItems: LineItem[] = parseInvoiceLineItems(invoice.lineItems);
  const curSym = invoice.currencySymbol || invoice.currency;

  // Resolve logo image path safely
  let logoBase64: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), 'public/logos/catalyst-symbol-dark.png');
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.warn('[PDF] Failed to load logo image:', err);
  }

  // Derive package display (Career Booster Package vs Premium Plus Package)
  const pkg = getPackageDetails(invoice.clientType, invoice.notes, lineItems);

  // Sanitized Transaction Reference (no internal UUID or private settlement notes)
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

  // Effective line items (fall back to package if lineItems is empty)
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
    <Document title={`Invoice-${invoice.invoiceNumber}-OFFICIAL`} author="Catalyst Talent Positioning Architecture">
      <Page size="A4" style={styles.page}>
        {/* ── 1. Top Executive Header ── */}
        <View style={styles.headerBar}>
          <View style={styles.brandLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoBase64 && <Image src={logoBase64} style={styles.logoImage} />}
            <View>
              <Text style={styles.brandTitle}>CATALYST TALENT POSITIONING ARCHITECTURE</Text>
              <Text style={styles.brandSubtitle}>A Division of Ripple Nexus Group · Global Executive Career Services</Text>
              <Text style={styles.brandOrg}>Corporate Legal Entity: Ripple Nexus Services · Institutional Fiscal Ledger</Text>
            </View>
          </View>
          <View style={styles.receiptBadgeContainer}>
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>✓ PAID &amp; SETTLED</Text>
            </View>
            <Text style={styles.receiptTitle}>Official Tax Invoice &amp; Receipt</Text>
          </View>
        </View>

        {/* ── 2. Prominent Purchased Package Banner ── */}
        <View style={styles.packageBanner}>
          <View>
            <Text style={styles.packageTag}>Purchased Service Architecture</Text>
            <Text style={styles.packageName}>{pkg.packageName}</Text>
            <Text style={styles.packageSubtitle}>{pkg.trackName}</Text>
          </View>
          <View style={styles.packageRight}>
            <Text style={styles.slaTag}>Guaranteed Delivery SLA</Text>
            <Text style={styles.slaValue}>{pkg.slaDays}</Text>
          </View>
        </View>

        {/* ── 3. Client & Invoice Particulars ── */}
        <View style={styles.gridTwoCol}>
          {/* Client Info */}
          <View style={styles.infoCardLeft}>
            <Text style={styles.cardTitle}>Client Principal (Billed To)</Text>
            <Text style={styles.cardLineBold}>{invoice.clientName}</Text>
            <Text style={styles.cardLine}>{invoice.clientEmail}</Text>
            {invoice.clientPhone && <Text style={styles.cardLine}>{invoice.clientPhone}</Text>}
            {invoice.companyName && <Text style={styles.cardLine}>Affiliation: {invoice.companyName}</Text>}
            <Text style={styles.cardLine}>Jurisdiction: {invoice.country || 'Global'}</Text>
          </View>

          {/* Invoice Summary */}
          <View style={styles.infoCardRight}>
            <Text style={styles.cardTitle}>Fiscal Ledger &amp; Settlement Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Number:</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issue Date:</Text>
              <Text style={styles.metaValue}>{issueDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Settlement Date:</Text>
              <Text style={styles.metaValue}>{paidDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Rail:</Text>
              <Text style={styles.metaValue}>{invoice.paymentGateway || 'Online Secured Rail'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Transaction Ref:</Text>
              <Text style={styles.metaValue}>{cleanTxnRef}</Text>
            </View>
          </View>
        </View>

        {/* ── 4. Itemized Investment Ledger ── */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.thDesc}>SERVICE SPECIFICATION &amp; DELIVERABLES</Text>
            <Text style={styles.thQty}>QTY</Text>
            <Text style={styles.thPrice}>RATE</Text>
            <Text style={styles.thTotal}>TOTAL</Text>
          </View>

          {displayItems.map((item, idx) => {
            const isAlt = idx % 2 === 1;
            const sanitized = sanitizeItemDescription(item.description, pkg.packageName);
            return (
              <View key={item.id || idx} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                <View style={styles.tdDesc}>
                  <Text style={styles.tdDescMain}>{sanitized.title}</Text>
                  {sanitized.subtitle && (
                    <Text style={styles.tdDescSub}>{sanitized.subtitle}</Text>
                  )}
                </View>
                <Text style={styles.tdQty}>{item.qty}</Text>
                <Text style={styles.tdPrice}>
                  {curSym}{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.tdTotal}>
                  {curSym}{item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── 5. Financial Reconciliation Box ── */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Subtotal Net:</Text>
              <Text style={styles.summaryVal}>
                {curSym}{invoice.subtotalConverted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            {invoice.discountAmount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Institutional Concession ({invoice.discountRate}%):</Text>
                <Text style={styles.summaryVal}>
                  -{curSym}{invoice.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {invoice.taxAmount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Applicable Tax ({invoice.taxRate}%):</Text>
                <Text style={styles.summaryVal}>
                  +{curSym}{invoice.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {invoice.processingFeeConverted > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Gateway &amp; Settlement Fee:</Text>
                <Text style={styles.summaryVal}>
                  +{curSym}{invoice.processingFeeConverted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total Settled ({invoice.currency}):</Text>
              <Text style={styles.totalVal}>
                {curSym}{invoice.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 6. Dedicated Service Level Agreement (SLA) & Governance Box ── */}
        <View style={styles.slaSection}>
          <View style={styles.slaHeaderRow}>
            <Text style={styles.slaHeading}>Service Level Agreement (SLA) &amp; Execution Protocols</Text>
            <Text style={styles.slaAssentBadge}>✓ Legally Binding SLA Assent Logged</Text>
          </View>
          <View style={styles.slaGrid}>
            <View style={styles.slaPillar}>
              <Text style={styles.pillarTitle}>Turnaround SLA Window</Text>
              <Text style={styles.pillarBody}>
                Guaranteed delivery within 7–10 business days following finalized intake questionnaire and career documentation sign-off.
              </Text>
            </View>
            <View style={styles.slaPillar}>
              <Text style={styles.pillarTitle}>Complimentary Revision SLA</Text>
              <Text style={styles.pillarBody}>
                Includes up to 2 rounds of strategic iterative calibrations requested within 7 calendar days of draft transmission.
              </Text>
            </View>
            <View style={styles.slaPillar}>
              <Text style={styles.pillarTitle}>Legal &amp; Contractual Governance</Text>
              <Text style={styles.pillarBody}>
                Enforceable pursuant to the Catalyst Talent Positioning Architecture SLA Framework &amp; Master Terms of Ripple Nexus Group.
              </Text>
            </View>
          </View>
        </View>

        {/* ── 7. Institutional Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerMain}>
            Catalyst Talent Positioning Architecture · A Division of Ripple Nexus Group · Corporate Entity: Ripple Nexus Services
          </Text>
          <Text style={styles.footerSub}>
            Global Executive Advisory &amp; Talent Architecture · support@theripplenexus.com · www.theripplenexus.com
          </Text>
          <Text style={styles.footerSub}>
            This electronic document represents an official, tamper-evident tax invoice and payment receipt under international commercial law. Authenticated by ClientForge Trust Infrastructure.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
