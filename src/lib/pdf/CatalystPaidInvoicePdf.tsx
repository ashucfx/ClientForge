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

// ── Palette Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  obsidian: '#0A0B0D',
  gold: '#B8935B',
  goldDark: '#9A7540',
  goldLight: '#F5EFE6',
  bone: '#FAF9F6',
  slateDark: '#1E293B',
  slateMuted: '#64748B',
  slateLight: '#F1F5F9',
  border: '#E2E8F0',
  emerald: '#059669',
  emeraldLight: '#ECFDF5',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
    color: COLORS.slateDark,
  },
  headerBar: {
    backgroundColor: COLORS.obsidian,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 8,
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  receiptBadgeContainer: {
    alignItems: 'flex-end',
  },
  paidBadge: {
    backgroundColor: COLORS.emeraldLight,
    borderWidth: 1,
    borderColor: COLORS.emerald,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
  },
  paidBadgeText: {
    color: COLORS.emerald,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },
  receiptTitle: {
    fontSize: 8,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridTwoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.bone,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  cardTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EBE4D9',
    paddingBottom: 3,
  },
  cardLine: {
    fontSize: 8.5,
    color: COLORS.slateDark,
    marginBottom: 2,
  },
  cardLineBold: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
    marginBottom: 3,
  },
  metaTable: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.slateLight,
  },
  metaLabel: {
    fontSize: 8,
    color: COLORS.slateMuted,
  },
  metaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.slateDark,
  },
  // Table
  tableContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.obsidian,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  thDesc: { flex: 4, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  thQty:  { flex: 1, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
  thPrice:{ flex: 1.5, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'right' },
  thTotal:{ flex: 1.5, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bone,
  },
  tdDesc: { flex: 4 },
  tdDescMain: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.slateDark },
  tdDescSub: { fontSize: 7.5, color: COLORS.slateMuted, marginTop: 1 },
  tdQty:  { flex: 1, fontSize: 8.5, textAlign: 'center', color: COLORS.slateDark },
  tdPrice:{ flex: 1.5, fontSize: 8.5, textAlign: 'right', color: COLORS.slateDark },
  tdTotal:{ flex: 1.5, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: COLORS.obsidian },
  // Summary
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  summaryBox: {
    width: 220,
    backgroundColor: COLORS.bone,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: COLORS.slateMuted,
  },
  summaryVal: {
    fontSize: 8.5,
    color: COLORS.slateDark,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.obsidian,
  },
  totalVal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.goldDark,
  },
  // Notice & Footer
  noticeBox: {
    backgroundColor: COLORS.goldLight,
    borderWidth: 1,
    borderColor: '#E8DBC5',
    borderRadius: 6,
    padding: 8,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 7.5,
    color: '#785A28',
    lineHeight: 1.3,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 7,
    color: COLORS.slateMuted,
  },
});

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

  const txnId =
    invoice.razorpayPaymentId ||
    invoice.paypalInvoiceId ||
    invoice.settlementNote ||
    `TXN-${invoice.id.slice(-8).toUpperCase()}`;

  const issueDateStr = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(invoice.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const paidDateStr = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Settled';

  return (
    <Document title={`Invoice-${invoice.invoiceNumber}-PAID`} author="Catalyst (Ripple Nexus)">
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <View style={styles.brandLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoBase64 && <Image src={logoBase64} style={styles.logoImage} />}
            <View>
              <Text style={styles.brandTitle}>CATALYST</Text>
              <Text style={styles.brandSubtitle}>Executive Career Booster Services</Text>
            </View>
          </View>
          <View style={styles.receiptBadgeContainer}>
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>✓ PAID &amp; SETTLED</Text>
            </View>
            <Text style={styles.receiptTitle}>Official Tax Invoice / Receipt</Text>
          </View>
        </View>

        {/* Client & Issuer Details */}
        <View style={styles.gridTwoCol}>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Billed To (Client)</Text>
            <Text style={styles.cardLineBold}>{invoice.clientName}</Text>
            <Text style={styles.cardLine}>{invoice.clientEmail}</Text>
            {invoice.clientPhone && <Text style={styles.cardLine}>{invoice.clientPhone}</Text>}
            {invoice.companyName && <Text style={styles.cardLine}>Company: {invoice.companyName}</Text>}
            <Text style={styles.cardLine}>Location: {invoice.country}</Text>
          </View>

          <View style={styles.metaTable}>
            <Text style={styles.cardTitle}>Invoice Summary</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Number:</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issue Date:</Text>
              <Text style={styles.metaValue}>{issueDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Date:</Text>
              <Text style={styles.metaValue}>{paidDateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Rail:</Text>
              <Text style={styles.metaValue}>{invoice.paymentGateway || 'Razorpay'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Transaction Ref:</Text>
              <Text style={styles.metaValue}>{txnId}</Text>
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.thDesc}>SERVICE COMPONENT &amp; DESCRIPTION</Text>
            <Text style={styles.thQty}>QTY</Text>
            <Text style={styles.thPrice}>UNIT PRICE</Text>
            <Text style={styles.thTotal}>TOTAL</Text>
          </View>

          {lineItems.map((item, idx) => {
            const isAlt = idx % 2 === 1;
            return (
              <View key={item.id || idx} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                <View style={styles.tdDesc}>
                  <Text style={styles.tdDescMain}>{item.description}</Text>
                  {item.shortDescription && (
                    <Text style={styles.tdDescSub}>{item.shortDescription}</Text>
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

        {/* Summary Box */}
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
                <Text style={styles.summaryLabel}>Discount ({invoice.discountRate}%):</Text>
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
              <Text style={styles.totalLabel}>Total Paid ({invoice.currency}):</Text>
              <Text style={styles.totalVal}>
                {curSym}{invoice.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Compliance / SLA Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            <strong>Turnaround SLA &amp; Fulfillment Commitment:</strong> This tax invoice confirms full settlement. Your dedicated drafting window operates under standard business days (5–7 working days for initial drafts). All deliverables include up to 2 complimentary revision rounds within 7 calendar days of draft delivery.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Catalyst Career Booster Services · Corporate Entity: Ripple Nexus · support@theripplenexus.com
          </Text>
          <Text style={{ marginTop: 2 }}>
            This document serves as an official electronic receipt and tax invoice. Generated securely via ClientForge.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
