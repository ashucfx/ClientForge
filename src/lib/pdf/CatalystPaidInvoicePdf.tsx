// src/lib/pdf/CatalystPaidInvoicePdf.tsx
// Official Catalyst Paid Tax Invoice & Receipt Generator
// Exact executive layout matching the Catalyst Talent Positioning Architecture specification
// Rendered on A4 with @react-pdf/renderer

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Polygon,
  Circle,
  Path,
  Line,
} from '@react-pdf/renderer';
import crypto from 'crypto';
import type { InvoiceData, LineItem } from '@/types';
import { parseInvoiceLineItems } from '@/lib/invoiceLineItems';
import { resolveInvoicePackage } from '@/lib/invoicePackageResolver';
import { formatCurrency } from '@/lib/pricing';

// ── Ultra-Luxury Executive Palette Tokens ─────────────────────────────────────
const COLORS = {
  bgCanvas: '#F8F6F2',
  white: '#FFFFFF',
  frameBorder: '#E5DAC8',
  topAccentGold: '#B8935B',
  topAccentGoldLight: '#D4AF7A',
  goldText: '#9A7540',
  goldAccent: '#B8935B',
  obsidian: '#0A0B0D',
  slateDark: '#1E293B',
  slateHeading: '#334155',
  slateBody: '#475569',
  slateMuted: '#64748B',
  slateSubtle: '#8A94A6',
  slateLightBorder: '#EAE3D5',
  cardBg: '#FAF8F5',
  cardBorder: '#E5DAC8',
  tableHeaderBg: '#F3EDE2',
  totalBoxBg: '#0A0B0D',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  emeraldText: '#065F46',
  emeraldDot: '#059669',
  badgeCompBg: '#FEF3C7',
  badgeCompText: '#92400E',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bgCanvas,
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: COLORS.slateBody,
  },
  // ── Frame Container (White Executive Sheet) ──
  documentFrame: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.frameBorder,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  topAccentBarWrap: {
    width: '100%',
  },
  topAccentBarGold: {
    height: 3.5,
    backgroundColor: COLORS.topAccentGold,
  },
  topAccentBarLight: {
    height: 1,
    backgroundColor: COLORS.topAccentGoldLight,
  },
  frameContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 38,
    height: 44,
    marginRight: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandTitleMain: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    letterSpacing: 1.6,
  },
  brandTitleSeparator: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: COLORS.topAccentGoldLight,
    marginHorizontal: 5,
  },
  brandTitleSub: {
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldText,
    letterSpacing: 1.2,
  },
  brandSubline: {
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateMuted,
    letterSpacing: 0.8,
    marginTop: 2.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  taxInvoiceTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    letterSpacing: 0.8,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emeraldBg,
    borderWidth: 0.8,
    borderColor: COLORS.emeraldBorder,
    borderRadius: 4,
    paddingVertical: 2.2,
    paddingHorizontal: 7,
    marginTop: 3,
  },
  paidDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.emeraldDot,
    marginRight: 4,
  },
  paidBadgeText: {
    fontSize: 6.6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.emeraldText,
    letterSpacing: 0.8,
  },
  hairline: {
    height: 0.8,
    backgroundColor: COLORS.slateLightBorder,
    marginBottom: 8,
  },

  // ── Metadata Cards (Billed To & Fiscal Ledger) ──
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaCardLeft: {
    width: '49%',
    backgroundColor: COLORS.cardBg,
    borderWidth: 0.8,
    borderColor: COLORS.cardBorder,
    borderRadius: 6,
    padding: 8,
  },
  metaCardRight: {
    width: '49%',
    backgroundColor: COLORS.cardBg,
    borderWidth: 0.8,
    borderColor: COLORS.cardBorder,
    borderRadius: 6,
    padding: 8,
  },
  cardLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldText,
    letterSpacing: 0.8,
    marginBottom: 2.5,
  },
  clientName: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    marginBottom: 1.5,
  },
  clientDetail: {
    fontSize: 6.8,
    color: COLORS.slateBody,
    marginBottom: 1,
  },
  jurisdictionPill: {
    marginTop: 2.5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: COLORS.cardBorder,
    borderRadius: 3,
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
  },
  jurisdictionText: {
    fontSize: 6,
    color: COLORS.slateMuted,
  },
  jurisdictionValue: {
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  fiscalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4.5,
  },
  fiscalCol: {
    width: '48%',
  },
  fiscalValueMono: {
    fontSize: 7,
    fontFamily: 'Courier-Bold',
    color: COLORS.obsidian,
  },
  fiscalValue: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },

  // ── Engagement Scope Banner ──
  scopeBanner: {
    backgroundColor: COLORS.obsidian,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: COLORS.topAccentGold,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scopeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  scopeBadge: {
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.topAccentGoldLight,
    letterSpacing: 0.8,
    marginRight: 7,
  },
  scopeTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    marginRight: 6,
  },
  scopeSub: {
    fontSize: 7,
    color: '#94A3B8',
  },
  slaPill: {
    backgroundColor: '#1E293B',
    borderWidth: 0.6,
    borderColor: '#475569',
    borderRadius: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
  },
  slaPillText: {
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: '#F1F5F9',
    letterSpacing: 0.6,
  },

  // ── Line Items Table ──
  tableContainer: {
    marginBottom: 7,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.tableHeaderBg,
    borderRadius: 4,
    borderWidth: 0.6,
    borderColor: COLORS.cardBorder,
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    alignItems: 'center',
  },
  thDesc:  { flex: 5.2, fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: COLORS.slateHeading, letterSpacing: 0.6 },
  thQty:   { flex: 0.8, fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: COLORS.slateHeading, textAlign: 'center', letterSpacing: 0.6 },
  thRate:  { flex: 1.8, fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: COLORS.slateHeading, textAlign: 'right', letterSpacing: 0.6 },
  thTotal: { flex: 1.8, fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: COLORS.slateHeading, textAlign: 'right', letterSpacing: 0.6 },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderBottomWidth: 0.6,
    borderBottomColor: COLORS.slateLightBorder,
    alignItems: 'center',
  },
  tdDesc: {
    flex: 5.2,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 7.8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  compBadge: {
    backgroundColor: COLORS.badgeCompBg,
    borderRadius: 3,
    paddingVertical: 1,
    paddingHorizontal: 4,
    marginLeft: 5,
  },
  compBadgeText: {
    fontSize: 5.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.badgeCompText,
    letterSpacing: 0.5,
  },
  itemSub: {
    fontSize: 6.2,
    color: COLORS.slateMuted,
    marginTop: 1,
  },
  tdQty: {
    flex: 0.8,
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateDark,
    textAlign: 'center',
  },
  tdRate: {
    flex: 1.8,
    fontSize: 7.2,
    color: COLORS.slateDark,
    textAlign: 'right',
  },
  tdTotal: {
    flex: 1.8,
    fontSize: 7.6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    textAlign: 'right',
  },
  tdTotalFree: {
    flex: 1.8,
    fontSize: 7.6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.emeraldDot,
    textAlign: 'right',
  },

  // ── Financial Totals Section ──
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 7,
  },
  totalsInner: {
    width: 245,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.8,
  },
  totalRowLabel: {
    fontSize: 6.8,
    color: COLORS.slateMuted,
  },
  totalRowVal: {
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  totalsDivider: {
    height: 0.6,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 3.5,
  },
  settledTotalBox: {
    backgroundColor: COLORS.totalBoxBg,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.topAccentGold,
    paddingVertical: 6,
    paddingHorizontal: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  settledLeft: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.topAccentGoldLight,
    letterSpacing: 0.8,
  },
  settledRight: {
    alignItems: 'flex-end',
  },
  settledAmount: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
  },
  settledSub: {
    fontSize: 5.5,
    color: '#94A3B8',
    marginTop: 1,
  },

  // ── Service Level Agreement & Execution Protocol ──
  slaContainer: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 0.8,
    borderColor: COLORS.cardBorder,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  slaHeaderBar: {
    backgroundColor: COLORS.tableHeaderBg,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderBottomWidth: 0.6,
    borderBottomColor: COLORS.cardBorder,
  },
  slaHeaderTitle: {
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateHeading,
    letterSpacing: 0.8,
  },
  slaBodyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 7,
  },
  slaColumn: {
    width: '32%',
  },
  slaPillarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  slaBullet: {
    width: 3.2,
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: COLORS.topAccentGold,
    marginRight: 4,
  },
  slaPillarTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  slaPillarText: {
    fontSize: 5.8,
    color: COLORS.slateBody,
    lineHeight: 1.3,
  },

  // ── Legal Sign-Off & Security Verification Seal ──
  bottomCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  entityCard: {
    width: '58%',
    paddingRight: 6,
  },
  entityLabel: {
    fontSize: 5.8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldText,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  entityName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    marginBottom: 1,
  },
  entitySubBrand: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldAccent,
    marginBottom: 1,
  },
  entityMeta: {
    fontSize: 6,
    color: COLORS.slateMuted,
  },

  sealCard: {
    width: '40%',
    backgroundColor: COLORS.cardBg,
    borderWidth: 0.8,
    borderColor: COLORS.cardBorder,
    borderRadius: 5,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sealIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.emeraldBg,
    borderWidth: 0.6,
    borderColor: COLORS.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  sealRight: {
    flex: 1,
  },
  sealTitle: {
    fontSize: 6.2,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.emeraldText,
    letterSpacing: 0.6,
  },
  sealHash: {
    fontSize: 5.5,
    fontFamily: 'Courier',
    color: COLORS.slateMuted,
    marginTop: 0.8,
  },
  sealSub: {
    fontSize: 5.2,
    color: COLORS.slateSubtle,
    marginTop: 0.8,
  },

  // ── Micro Footer ──
  footerLine: {
    height: 0.6,
    backgroundColor: COLORS.slateLightBorder,
    marginBottom: 5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    fontSize: 5.8,
    color: COLORS.slateSubtle,
  },
  footerRight: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldText,
    letterSpacing: 0.6,
  },
});

// ── Package Categorization Helper ─────────────────────────────────────────────
function getPackageDetails(clientType?: string | null, notes?: string | null, lineItems: LineItem[] = []) {
  return resolveInvoicePackage(clientType, notes, lineItems);
}

// ── Clean Line Item Description Sanitizer (Strictly No Internal Leaks) ────────
function sanitizeItemDescription(rawDesc: string, pkgName: string): { title: string; subtitle?: string; isComp?: boolean } {
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

export function CatalystPaidInvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  const lineItems: LineItem[] = parseInvoiceLineItems(invoice.lineItems);
  const curSym = invoice.currencySymbol || invoice.currency;
  const fmt = (n: number) => formatCurrency(n, curSym);

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

  // Jurisdiction calculation
  const isIndia = !invoice.country || invoice.country.toLowerCase().includes('india') || invoice.currency === 'INR';
  const jurisdictionLabel = isIndia ? 'India (Domestic Rail)' : `${invoice.country || 'International'} (Global Rail)`;

  // Payment gateway display
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
        <View style={styles.documentFrame}>
          {/* Top Gold Foil Accent Bar */}
          <View style={styles.topAccentBarWrap}>
            <View style={styles.topAccentBarGold} />
            <View style={styles.topAccentBarLight} />
          </View>

          <View style={styles.frameContent}>
            {/* ── 1. Top Executive Header ── */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {/* Catalyst Logo Vector Mark with Authentic Inflection Stroke */}
                <View style={styles.logoBox}>
                  <Svg width={36} height={42} viewBox="0 0 192 240">
                    {/* Primary Trajectory Stroke */}
                    <Polygon points="0,240 44,240 192,0 148,0" fill="#0A0B0D" />
                    {/* Strategic Gold Intervention Stroke */}
                    <Polygon points="192,0 148,0 100,76 144,76" fill="#B8935B" />
                    {/* Inflection Pivot Dot */}
                    <Circle cx="170" cy="22" r="5" fill="#FAF8F5" />
                  </Svg>
                </View>
                <View>
                  <View style={styles.brandTitleRow}>
                    <Text style={styles.brandTitleMain}>CATALYST</Text>
                    <Text style={styles.brandTitleSeparator}>|</Text>
                    <Text style={styles.brandTitleSub}>TALENT POSITIONING ARCHITECTURE</Text>
                  </View>
                  <Text style={styles.brandSubline}>A SUB-BRAND OF RIPPLE NEXUS • EXECUTIVE CLIENT SERVICES</Text>
                </View>
              </View>

              <View style={styles.headerRight}>
                <Text style={styles.taxInvoiceTitle}>TAX INVOICE &amp; RECEIPT</Text>
                <View style={styles.paidBadge}>
                  <View style={styles.paidDot} />
                  <Text style={styles.paidBadgeText}>PAID &amp; SETTLED</Text>
                </View>
              </View>
            </View>

            <View style={styles.hairline} />

            {/* ── 2. Metadata Cards ── */}
            <View style={styles.metaGrid}>
              {/* Left: Client Card */}
              <View style={styles.metaCardLeft}>
                <Text style={styles.cardLabel}>BILLED TO (PRINCIPAL CLIENT)</Text>
                <Text style={styles.clientName}>{invoice.clientName}</Text>
                <Text style={styles.clientDetail}>{invoice.clientEmail}</Text>
                {invoice.clientPhone ? <Text style={styles.clientDetail}>{invoice.clientPhone}</Text> : null}
                <View style={styles.jurisdictionPill}>
                  <Text style={styles.jurisdictionText}>
                    Jurisdiction: <Text style={styles.jurisdictionValue}>{jurisdictionLabel}</Text>
                  </Text>
                </View>
              </View>

              {/* Right: Fiscal Ledger Card */}
              <View style={styles.metaCardRight}>
                <View style={styles.fiscalRow}>
                  <View style={styles.fiscalCol}>
                    <Text style={styles.cardLabel}>INVOICE NUMBER</Text>
                    <Text style={styles.fiscalValueMono}>{invoice.invoiceNumber}</Text>
                  </View>
                  <View style={styles.fiscalCol}>
                    <Text style={styles.cardLabel}>TRANSACTION REF</Text>
                    <Text style={styles.fiscalValueMono}>{cleanTxnRef}</Text>
                  </View>
                </View>
                <View style={[styles.fiscalRow, { marginBottom: 0 }]}>
                  <View style={styles.fiscalCol}>
                    <Text style={styles.cardLabel}>ISSUE DATE</Text>
                    <Text style={styles.fiscalValue}>{issueDateStr}</Text>
                  </View>
                  <View style={styles.fiscalCol}>
                    <Text style={styles.cardLabel}>SETTLEMENT DATE</Text>
                    <Text style={styles.fiscalValue}>{paidDateStr}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── 3. Engagement Scope Banner ── */}
            <View style={styles.scopeBanner}>
              <View style={styles.scopeLeft}>
                <Text style={styles.scopeBadge}>ENGAGEMENT SPECIFICATION</Text>
                <Text style={styles.scopeTitle}>{pkg.packageName}</Text>
                <Text style={styles.scopeSub}>{pkg.trackName}</Text>
              </View>
              <View style={styles.slaPill}>
                <Text style={styles.slaPillText}>GUARANTEED SLA: {pkg.slaDays}</Text>
              </View>
            </View>

            {/* ── 4. Line Items Table ── */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={styles.thDesc}>SERVICE SPECIFICATION &amp; DELIVERABLES</Text>
                <Text style={styles.thQty}>QTY</Text>
                <Text style={styles.thRate}>UNIT RATE</Text>
                <Text style={styles.thTotal}>NET AMOUNT</Text>
              </View>

              {displayItems.map((item, idx) => {
                const sanitized = sanitizeItemDescription(item.description, pkg.packageName);
                const isFree = item.lineTotal === 0 || sanitized.isComp;
                const qtyStr = item.qty < 10 ? `0${item.qty}` : `${item.qty}`;
                const formattedRate = isFree ? fmt(0) : fmt(item.unitPrice);
                const formattedTotal = isFree ? fmt(0) : fmt(item.lineTotal);

                return (
                  <View key={item.id || idx} style={styles.tableRow}>
                    <View style={styles.tdDesc}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemTitle}>{sanitized.title}</Text>
                        {isFree && (
                          <View style={styles.compBadge}>
                            <Text style={styles.compBadgeText}>COMPLIMENTARY</Text>
                          </View>
                        )}
                      </View>
                      {sanitized.subtitle && <Text style={styles.itemSub}>{sanitized.subtitle}</Text>}
                    </View>
                    <Text style={styles.tdQty}>{qtyStr}</Text>
                    <Text style={styles.tdRate}>{formattedRate}</Text>
                    <Text style={isFree ? styles.tdTotalFree : styles.tdTotal}>{formattedTotal}</Text>
                  </View>
                );
              })}
            </View>

            {/* ── 5. Financial Reconciliation Totals ── */}
            <View style={styles.totalsSection}>
              <View style={styles.totalsInner}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Net Subtotal</Text>
                  <Text style={styles.totalRowVal}>
                    {fmt(invoice.subtotalConverted)}
                  </Text>
                </View>

                {invoice.discountAmount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalRowLabel, { color: COLORS.emeraldDot }]}>
                      Concession / Discount (-{invoice.discountRate}%)
                    </Text>
                    <Text style={[styles.totalRowVal, { color: COLORS.emeraldDot }]}>
                      -{fmt(invoice.discountAmount)}
                    </Text>
                  </View>
                )}

                {invoice.taxAmount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabel}>Applicable Tax (+{invoice.taxRate}%)</Text>
                    <Text style={styles.totalRowVal}>
                      +{fmt(invoice.taxAmount)}
                    </Text>
                  </View>
                )}

                {invoice.processingFeeConverted > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabel}>Processing &amp; Settlement Fee</Text>
                    <Text style={styles.totalRowVal}>
                      +{fmt(invoice.processingFeeConverted)}
                    </Text>
                  </View>
                )}

                <View style={styles.totalsDivider} />

                {/* Dark Settled Total Box */}
                <View style={styles.settledTotalBox}>
                  <Text style={styles.settledLeft}>TOTAL PAID ({invoice.currency})</Text>
                  <View style={styles.settledRight}>
                    <Text style={styles.settledAmount}>
                      {fmt(invoice.totalPayable)}
                    </Text>
                    <Text style={styles.settledSub}>{gatewayLabel}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── 6. Service Level Agreement & Execution Protocol ── */}
            <View style={styles.slaContainer}>
              <View style={styles.slaHeaderBar}>
                <Text style={styles.slaHeaderTitle}>SERVICE LEVEL AGREEMENT &amp; EXECUTION PROTOCOL</Text>
              </View>
              <View style={styles.slaBodyGrid}>
                {/* Col 1 */}
                <View style={styles.slaColumn}>
                  <View style={styles.slaPillarTitleRow}>
                    <View style={styles.slaBullet} />
                    <Text style={styles.slaPillarTitle}>Turnaround SLA Window</Text>
                  </View>
                  <Text style={styles.slaPillarText}>
                    Delivery guaranteed within 7–10 business days following intake sign-off.
                  </Text>
                </View>

                {/* Col 2 */}
                <View style={styles.slaColumn}>
                  <View style={styles.slaPillarTitleRow}>
                    <View style={styles.slaBullet} />
                    <Text style={styles.slaPillarTitle}>Calibrations &amp; Revisions</Text>
                  </View>
                  <Text style={styles.slaPillarText}>
                    Includes 2 iterative calibration cycles within 7 calendar days of draft dispatch.
                  </Text>
                </View>

                {/* Col 3 */}
                <View style={styles.slaColumn}>
                  <View style={styles.slaPillarTitleRow}>
                    <View style={styles.slaBullet} />
                    <Text style={styles.slaPillarTitle}>Governance &amp; Authority</Text>
                  </View>
                  <Text style={styles.slaPillarText}>
                    Enforceable under Catalyst Governance &amp; Ripple Nexus Master Framework.
                  </Text>
                </View>
              </View>
            </View>

            {/* ── 7. Corporate Entity Sign-Off & Verification Seal ── */}
            <View style={styles.bottomCardsRow}>
              {/* Left: Issuing Legal Entity */}
              <View style={styles.entityCard}>
                <Text style={styles.entityLabel}>ISSUING CORPORATE LEGAL ENTITY</Text>
                <Text style={styles.entityName}>Ripple Nexus</Text>
                <Text style={styles.entitySubBrand}>Operating as Catalyst (A Sub-Brand of Ripple Nexus)</Text>
                <Text style={styles.entityMeta}>Global Talent Positioning Architecture • catalyst.theripplenexus.com</Text>
              </View>

              {/* Right: Cryptographic Verification Seal */}
              <View style={styles.sealCard}>
                <View style={styles.sealIconWrap}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path
                      d="M5 13l4 4L19 7"
                      stroke="#059669"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </View>
                <View style={styles.sealRight}>
                  <Text style={styles.sealTitle}>CRYPTOGRAPHICALLY VERIFIED</Text>
                  <Text style={styles.sealHash}>{shortHash}</Text>
                  <Text style={styles.sealSub}>Authenticated Digital Receipt</Text>
                </View>
              </View>
            </View>

            {/* ── 8. Micro Footer ── */}
            <View style={styles.footerLine} />
            <View style={styles.footerRow}>
              <Text style={styles.footerLeft}>
                This document is an authenticated tax invoice and receipt for talent architecture services rendered.
              </Text>
              <Text style={styles.footerRight}>CATALYST • TALENT POSITIONING ARCHITECTURE • RIPPLE NEXUS</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
