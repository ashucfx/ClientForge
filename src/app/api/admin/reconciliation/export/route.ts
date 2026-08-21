// src/app/api/admin/reconciliation/export/route.ts
// GET ?format=pdf|docx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Generates a downloadable fee reconciliation report in PDF or DOCX format.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { amountToInr } from '@/lib/fx';
import {
  Document as DocxDocument, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
} from 'docx';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  Document as PdfDoc, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── PDF Styles ───────────────────────────────────────────────────────────────
const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#0F172A' },
  subtitle: { fontSize: 10, color: '#64748B', marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1E40AF', marginBottom: 6, borderBottom: '1pt solid #BFDBFE', paddingBottom: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  summaryLabel: { color: '#64748B', width: '50%' },
  summaryValue: { fontFamily: 'Helvetica-Bold', color: '#0F172A', textAlign: 'right', width: '50%' },
  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1E3A8A', padding: 4 },
  tableRow: { flexDirection: 'row', padding: 4, borderBottom: '0.5pt solid #E2E8F0' },
  tableRowAlt: { flexDirection: 'row', padding: 4, borderBottom: '0.5pt solid #E2E8F0', backgroundColor: '#F8FAFC' },
  thCell: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tdCell: { color: '#334155', fontSize: 8 },
  red: { color: '#DC2626' },
  green: { color: '#16A34A' },
  orange: { color: '#D97706' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 7, color: '#94A3B8', textAlign: 'center' },
});

// ─── Shared data fetcher ──────────────────────────────────────────────────────
async function fetchData(fromDate?: Date, toDate?: Date) {
  const dateFilter = fromDate || toDate ? {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lte: toDate } : {}),
  } : undefined;

  const [invoices, manualCareer, manualRn] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'PAID', ...(dateFilter ? { paidAt: dateFilter } : {}) },
      select: {
        id: true, invoiceNumber: true, clientName: true, clientEmail: true,
        totalPayable: true, subtotalConverted: true, processingFeeConverted: true,
        taxAmount: true, currency: true, paymentGateway: true, brandId: true,
        paidAt: true, amountSettledInr: true, settlementNote: true, settledAt: true,
      },
      orderBy: { paidAt: 'desc' },
    }),
    db.careerClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { id: true, name: true, email: true, amountPaid: true, currency: true, createdAt: true, amountSettledInr: true, settlementNote: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.rnClient.findMany({
      where: { invoiceId: null, amountPaid: { gt: 0 }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { id: true, name: true, email: true, amountPaid: true, currency: true, createdAt: true, amountSettledInr: true, settlementNote: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  type Row = {
    ref: string; clientName: string; clientEmail: string; gateway: string;
    currency: string; grossInr: number; netInr: number; settledInr: number | null;
    gapInr: number | null; gapPct: number | null; date: string; note: string;
  };

  const rows: Row[] = [];

  for (const inv of invoices) {
    const grossInr = Math.round(await amountToInr(inv.totalPayable, inv.currency));
    const netInr = Math.round(await amountToInr(inv.subtotalConverted, inv.currency));
    const settledInr = inv.amountSettledInr ?? null;
    const gapInr = settledInr !== null ? netInr - settledInr : null;
    const gapPct = settledInr !== null && netInr > 0 ? Math.round(((netInr - settledInr) / netInr) * 1000) / 10 : null;
    rows.push({
      ref: inv.invoiceNumber, clientName: inv.clientName, clientEmail: inv.clientEmail,
      gateway: inv.paymentGateway, currency: inv.currency, grossInr, netInr,
      settledInr, gapInr, gapPct, date: inv.paidAt?.toISOString().slice(0, 10) ?? '',
      note: inv.settlementNote ?? '',
    });
  }

  for (const c of manualCareer) {
    const grossInr = Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR'));
    const settledInr = c.amountSettledInr ?? null;
    const gapInr = settledInr !== null ? grossInr - settledInr : null;
    const gapPct = settledInr !== null && grossInr > 0 ? Math.round(((grossInr - settledInr) / grossInr) * 1000) / 10 : null;
    rows.push({
      ref: `CAREER-${c.id.slice(0, 8).toUpperCase()}`, clientName: c.name, clientEmail: c.email,
      gateway: 'MANUAL', currency: c.currency ?? 'INR', grossInr, netInr: grossInr,
      settledInr, gapInr, gapPct, date: c.createdAt.toISOString().slice(0, 10), note: c.settlementNote ?? '',
    });
  }

  for (const c of manualRn) {
    const grossInr = Math.round(await amountToInr(c.amountPaid, c.currency ?? 'INR'));
    const settledInr = c.amountSettledInr ?? null;
    const gapInr = settledInr !== null ? grossInr - settledInr : null;
    const gapPct = settledInr !== null && grossInr > 0 ? Math.round(((grossInr - settledInr) / grossInr) * 1000) / 10 : null;
    rows.push({
      ref: `RN-${c.id.slice(0, 8).toUpperCase()}`, clientName: c.name, clientEmail: c.email,
      gateway: 'MANUAL', currency: c.currency ?? 'INR', grossInr, netInr: grossInr,
      settledInr, gapInr, gapPct, date: c.createdAt.toISOString().slice(0, 10), note: c.settlementNote ?? '',
    });
  }

  const reconRows = rows.filter(r => r.settledInr !== null);
  const totalGross = rows.reduce((s, r) => s + r.grossInr, 0);
  const totalNet = rows.reduce((s, r) => s + r.netInr, 0);
  const totalSettled = reconRows.reduce((s, r) => s + (r.settledInr ?? 0), 0);
  const totalGap = reconRows.reduce((s, r) => s + (r.gapInr ?? 0), 0);
  const avgFeeRate = reconRows.length > 0
    ? Math.round(reconRows.reduce((s, r) => s + (r.gapPct ?? 0), 0) / reconRows.length * 10) / 10
    : 0;

  const gatewayMap: Record<string, { net: number; settled: number; count: number }> = {};
  for (const r of reconRows) {
    const gw = r.gateway;
    if (!gatewayMap[gw]) gatewayMap[gw] = { net: 0, settled: 0, count: 0 };
    gatewayMap[gw].net += r.netInr;
    gatewayMap[gw].settled += r.settledInr ?? 0;
    gatewayMap[gw].count += 1;
  }

  return {
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
    summary: { totalGross, totalNet, totalSettled, totalGap, avgFeeRate, reconCount: reconRows.length, totalCount: rows.length },
    gatewayMap,
  };
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── PDF Generator ────────────────────────────────────────────────────────────
async function generatePdf(fromStr?: string, toStr?: string) {
  const fromDate = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(toStr) : undefined;
  const { rows, summary, gatewayMap } = await fetchData(fromDate, toDate);
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const dateRange = fromStr && toStr ? `${fromStr} to ${toStr}` : 'All Time';

  const PdfReport = () =>
    React.createElement(PdfDoc, null,
      React.createElement(Page, { size: 'A4', orientation: 'landscape', style: pdfStyles.page },
        // Header
        React.createElement(View, { style: pdfStyles.section },
          React.createElement(Text, { style: pdfStyles.title }, 'Revenue Reconciliation Report'),
          React.createElement(Text, { style: pdfStyles.subtitle }, `Period: ${dateRange}  ·  Generated: ${generatedAt} IST  ·  ${summary.totalCount} transactions`),
        ),
        // Summary
        React.createElement(View, { style: pdfStyles.section },
          React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Executive Summary'),
          React.createElement(View, { style: pdfStyles.summaryRow },
            React.createElement(Text, { style: pdfStyles.summaryLabel }, 'Total Invoiced (Gross)'),
            React.createElement(Text, { style: pdfStyles.summaryValue }, fmt(summary.totalGross)),
          ),
          React.createElement(View, { style: pdfStyles.summaryRow },
            React.createElement(Text, { style: pdfStyles.summaryLabel }, 'Total Net Revenue (excl. gateway fees)'),
            React.createElement(Text, { style: pdfStyles.summaryValue }, fmt(summary.totalNet)),
          ),
          React.createElement(View, { style: pdfStyles.summaryRow },
            React.createElement(Text, { style: pdfStyles.summaryLabel }, `Total Actually Settled (${summary.reconCount}/${summary.totalCount} reconciled)`),
            React.createElement(Text, { style: pdfStyles.summaryValue }, fmt(summary.totalSettled)),
          ),
          React.createElement(View, { style: pdfStyles.summaryRow },
            React.createElement(Text, { style: pdfStyles.summaryLabel }, 'Total Revenue Leakage (fees paid to gateways)'),
            React.createElement(Text, { style: [pdfStyles.summaryValue, pdfStyles.red] }, `${fmt(summary.totalGap)}  (avg ${summary.avgFeeRate}%)`),
          ),
        ),
        // Gateway breakdown
        React.createElement(View, { style: pdfStyles.section },
          React.createElement(Text, { style: pdfStyles.sectionTitle }, 'By Payment Gateway'),
          ...Object.entries(gatewayMap).map(([gw, v]) =>
            React.createElement(View, { style: pdfStyles.summaryRow, key: gw },
              React.createElement(Text, { style: pdfStyles.summaryLabel }, `${gw} (${v.count} txns)`),
              React.createElement(Text, { style: pdfStyles.summaryValue },
                `Net: ${fmt(Math.round(v.net))}  →  Settled: ${fmt(Math.round(v.settled))}  ·  Gap: ${fmt(Math.round(v.net - v.settled))}  (${v.net > 0 ? ((v.net - v.settled) / v.net * 100).toFixed(1) : 0}%)`
              ),
            )
          ),
        ),
        // Transaction table
        React.createElement(View, { style: pdfStyles.section },
          React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Transaction Detail'),
          React.createElement(View, { style: pdfStyles.table },
            React.createElement(View, { style: pdfStyles.tableHeader },
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '12%' }] }, 'Reference'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '16%' }] }, 'Client'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '9%' }] }, 'Date'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '10%' }] }, 'Gateway'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '11%', textAlign: 'right' }] }, 'Gross (₹)'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '11%', textAlign: 'right' }] }, 'Net (₹)'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '11%', textAlign: 'right' }] }, 'Settled (₹)'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '10%', textAlign: 'right' }] }, 'Gap (₹)'),
              React.createElement(Text, { style: [pdfStyles.thCell, { width: '10%', textAlign: 'right' }] }, 'Fee %'),
            ),
            ...rows.map((r, i) =>
              React.createElement(View, { style: i % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt, key: r.ref },
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '12%' }] }, r.ref),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '16%' }] }, r.clientName.slice(0, 20)),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '9%' }] }, r.date),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '10%' }] }, r.gateway),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '11%', textAlign: 'right' }] }, r.grossInr.toLocaleString('en-IN')),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '11%', textAlign: 'right' }] }, r.netInr.toLocaleString('en-IN')),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '11%', textAlign: 'right' }] }, r.settledInr !== null ? r.settledInr.toLocaleString('en-IN') : '—'),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '10%', textAlign: 'right' }, r.gapInr !== null && r.gapInr > 0 ? pdfStyles.red : {}] }, r.gapInr !== null ? r.gapInr.toLocaleString('en-IN') : '—'),
                React.createElement(Text, { style: [pdfStyles.tdCell, { width: '10%', textAlign: 'right' }, r.gapPct !== null && r.gapPct > 0 ? pdfStyles.red : {}] }, r.gapPct !== null ? `${r.gapPct}%` : '—'),
              )
            ),
          ),
        ),
        React.createElement(Text, { style: pdfStyles.footer }, `ClientForge Revenue Reconciliation  ·  Confidential  ·  Generated ${generatedAt} IST`),
      )
    );

  return await renderToBuffer(React.createElement(PdfReport));
}

// ─── DOCX Generator ───────────────────────────────────────────────────────────
async function generateDocx(fromStr?: string, toStr?: string) {
  const fromDate = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(toStr) : undefined;
  const { rows, summary, gatewayMap } = await fetchData(fromDate, toDate);
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const dateRange = fromStr && toStr ? `${fromStr} to ${toStr}` : 'All Time';

  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  const headerCell = (text: string) => new TableCell({
    borders: cellBorders,
    shading: { fill: '1E3A8A' },
    children: [new Paragraph({ children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 16 })] })],
  });

  const dataCell = (text: string, bold = false, color = '334155') => new TableCell({
    borders: cellBorders,
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 16, color })] })],
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Revenue Reconciliation Report', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: `Period: ${dateRange}  ·  Generated: ${generatedAt} IST  ·  ${summary.totalCount} transactions`, color: '64748B', size: 18 })] }),
        new Paragraph({ text: '' }),

        new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2 }),
        ...[
          ['Total Invoiced (Gross)', fmt(summary.totalGross)],
          ['Total Net Revenue (excl. gateway fees)', fmt(summary.totalNet)],
          [`Total Actually Settled (${summary.reconCount}/${summary.totalCount} reconciled)`, fmt(summary.totalSettled)],
          ['Total Revenue Leakage (fees paid to gateways)', `${fmt(summary.totalGap)}  (avg ${summary.avgFeeRate}%)`],
        ].map(([label, value]) => new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: `${label}: `, size: 18, color: '64748B' }),
            new TextRun({ text: value, size: 18, bold: true, color: '0F172A' }),
          ],
        })),

        new Paragraph({ text: '' }),
        new Paragraph({ text: 'By Payment Gateway', heading: HeadingLevel.HEADING_2 }),
        ...Object.entries(gatewayMap).map(([gw, v]) => new Paragraph({
          children: [
            new TextRun({ text: `${gw} (${v.count} txns): `, size: 18, bold: true }),
            new TextRun({ text: `Net ${fmt(Math.round(v.net))}  →  Settled ${fmt(Math.round(v.settled))}  ·  Gap ${fmt(Math.round(v.net - v.settled))} (${v.net > 0 ? ((v.net - v.settled) / v.net * 100).toFixed(1) : 0}%)`, size: 18, color: '334155' }),
          ],
        })),

        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Transaction Detail', heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Reference'), headerCell('Client'), headerCell('Date'),
                headerCell('Gateway'), headerCell('Gross (₹)'), headerCell('Net (₹)'),
                headerCell('Settled (₹)'), headerCell('Gap (₹)'), headerCell('Fee %'),
              ],
            }),
            ...rows.map(r => new TableRow({
              children: [
                dataCell(r.ref),
                dataCell(r.clientName),
                dataCell(r.date),
                dataCell(r.gateway),
                dataCell(r.grossInr.toLocaleString('en-IN')),
                dataCell(r.netInr.toLocaleString('en-IN')),
                dataCell(r.settledInr !== null ? r.settledInr.toLocaleString('en-IN') : '—'),
                dataCell(r.gapInr !== null ? r.gapInr.toLocaleString('en-IN') : '—', false, r.gapInr !== null && r.gapInr > 0 ? 'DC2626' : '334155'),
                dataCell(r.gapPct !== null ? `${r.gapPct}%` : '—', false, r.gapPct !== null && r.gapPct > 0 ? 'DC2626' : '334155'),
              ],
            })),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: `ClientForge Revenue Reconciliation  ·  Confidential  ·  Generated ${generatedAt} IST`, size: 14, color: '94A3B8' })] }),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const format = sp.get('format') ?? 'pdf';
  const from = sp.get('from') ?? undefined;
  const to = sp.get('to') ?? undefined;

  if (format !== 'pdf' && format !== 'docx') {
    return NextResponse.json({ error: 'format must be pdf or docx' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `reconciliation-report-${today}`;

  if (format === 'pdf') {
    const buffer = await generatePdf(from, to);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  const buffer = await generateDocx(from, to);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}.docx"`,
    },
  });
}
