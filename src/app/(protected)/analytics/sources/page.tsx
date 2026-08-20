'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceSource {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  totalPayable: number;
  subtotalConverted: number;
  currency: string;
  currencySymbol: string;
  exchangeRate: number;
  processingFeeConverted: number;
  taxAmount: number;
  discountAmount: number;
  paidAt: string | null;
  brandId: string | null;
  paymentGateway: string | null;
  inrEquivalent: number;
  netInr: number;
  isRecent: boolean;
}

interface ManualClient {
  id: string;
  name: string;
  email: string;
  amountPaid: number;
  currency: string;
  inrEquivalent: number;
  source: 'career_manual' | 'rn_manual';
  packageType?: string | null;
  createdAt: string;
  isRecent: boolean;
}

interface FeedbackRow {
  id: string;
  npsScore: number;
  rating: number;
  communication: number;
  deliveryQuality: number;
  turnaroundTime: number;
  serviceType: string;
  comments: string | null;
  createdAt: string;
  careerClientId: string | null;
  rnClientId: string | null;
  careerClient?: { id: string; name: string; email: string } | null;
  rnClient?: { id: string; name: string; email: string } | null;
}

interface SourcesData {
  summary: {
    grandTotal: number;
    invoiceTotalInr: number;
    careerManualTotalInr: number;
    rnManualTotalInr: number;
    invoiceCount: number;
    manualCareerCount: number;
    manualRnCount: number;
    feedbackCount: number;
    lifetimeNps: number | null;
    lifetimeAvgRating: number | null;
    promoters: number;
    detractors: number;
    passives: number;
  };
  invoices: InvoiceSource[];
  manualCareer: ManualClient[];
  manualRn: ManualClient[];
  feedbacks: FeedbackRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtInr(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function NpsBadge({ score }: { score: number }) {
  if (score >= 9) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Promoter ({score})
      </span>
    );
  }
  if (score <= 6) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Detractor ({score})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Passive ({score})
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsSourcesPage() {
  const [data, setData] = useState<SourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'revenue' | 'nps'>('revenue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('ALL');

  useEffect(() => {
    fetch('/api/admin/analytics/sources')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    return data.invoices.filter(inv => {
      const matchSearch =
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCurrency = selectedCurrency === 'ALL' || inv.currency.toUpperCase() === selectedCurrency;
      return matchSearch && matchCurrency;
    });
  }, [data?.invoices, searchQuery, selectedCurrency]);

  // Filtered manual clients
  const filteredManualClients = useMemo(() => {
    if (!data) return [];
    const allManual = [...data.manualCareer, ...data.manualRn];
    return allManual.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCurrency = selectedCurrency === 'ALL' || (c.currency ?? 'INR').toUpperCase() === selectedCurrency;
      return matchSearch && matchCurrency;
    });
  }, [data, searchQuery, selectedCurrency]);

  // Unique currencies for dropdown
  const availableCurrencies = useMemo(() => {
    if (!data) return ['ALL'];
    const set = new Set<string>();
    data.invoices.forEach(i => set.add(i.currency.toUpperCase()));
    data.manualCareer.forEach(c => set.add((c.currency || 'INR').toUpperCase()));
    data.manualRn.forEach(c => set.add((c.currency || 'INR').toUpperCase()));
    return ['ALL', ...Array.from(set).sort()];
  }, [data]);

  return (
    <AppShell>
      <div className="w-full max-w-7xl 2xl:max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-10 py-6 sm:py-10">

        {/* ── Top Bar / Breadcrumb ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              <Link href="/analytics" className="text-[#B8935B] hover:text-[#9A7540] transition-colors flex items-center gap-1">
                <span>←</span> Back to Analytics
              </Link>
              <span>/</span>
              <span className="text-slate-600">Audit &amp; Telemetry</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <span>🔍</span>
              <span>Analytics Data Sources</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              100% transparent audit trail of every invoice, foreign exchange conversion, and client feedback response that powers your dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Direct DB Sync
            </div>
            <button
              onClick={() => { setLoading(true); fetch('/api/admin/analytics/sources').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors shadow-xs active:scale-95"
            >
              <span>↻</span> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-[#B8935B]/20 border-t-[#B8935B] rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Querying transaction ledger &amp; feedback data…</p>
          </div>
        ) : !data ? (
          <div className="card p-12 text-center text-slate-400 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200">
            Failed to load source telemetry. Please refresh the page.
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── KPI Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Grand Total Revenue */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#2D2418] text-white p-5 sm:p-6 shadow-md border border-[#B8935B]/30 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF7A]">All-Time Revenue</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B8935B]/30 text-[#F5E6CC] border border-[#B8935B]/40">
                    NET INR
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                    {fmtInr(data.summary.grandTotal)}
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                    <span>{data.summary.invoiceCount + data.summary.manualCareerCount + data.summary.manualRnCount} total transactions</span>
                    <span>·</span>
                    <span className="text-[#D4AF7A]">excl. fees/tax</span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#B8935B]/10 blur-2xl pointer-events-none" />
              </div>

              {/* Portal Invoices */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Source A: Invoices</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {data.summary.invoiceCount} Paid
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
                    {fmtInr(data.summary.invoiceTotalInr)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Direct portal payments via Razorpay &amp; PayPal
                  </p>
                </div>
              </div>

              {/* Manual Onboardings */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sources B &amp; C: Manual</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                    {data.summary.manualCareerCount + data.summary.manualRnCount} Clients
                  </span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
                    {fmtInr(data.summary.careerManualTotalInr + data.summary.rnManualTotalInr)}
                  </div>
                  <p className="text-xs text-slate-500">
                    External / offline clients with manual record
                  </p>
                </div>
              </div>

              {/* NPS & Satisfaction */}
              <div className="rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lifetime Satisfaction</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {data.summary.feedbackCount} Reviews
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                      {data.summary.lifetimeNps !== null ? data.summary.lifetimeNps : '—'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">NPS</span>
                    {data.summary.lifetimeAvgRating && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-auto">
                        ★ {data.summary.lifetimeAvgRating} / 5.0
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {data.summary.promoters} Promoters · {data.summary.passives} Passives · {data.summary.detractors} Detractors
                  </p>
                </div>
              </div>

            </div>

            {/* ── Visual Computation Rule Banner ── */}
            <div className="rounded-2xl bg-gradient-to-r from-[#FBF8F3] via-white to-[#F0EAE0] p-5 sm:p-6 border border-[#E8DDD0] shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📐</span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#7A5B2E]">
                  Revenue &amp; Analytics Normalization Engine
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed text-slate-600">
                <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-[#E8DDD0]">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1C1812] text-[#B8935B] text-[10px] font-black flex items-center justify-center">A</span>
                    Portal Invoices
                  </div>
                  <p>
                    Only includes invoices with <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">status: PAID</span>. Uses the legitimate net subtotal (excluding Razorpay fees and taxes), converted via recorded exchange rate.
                  </p>
                </div>
                <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-[#E8DDD0]">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1C1812] text-[#B8935B] text-[10px] font-black flex items-center justify-center">B</span>
                    Manual Career Clients
                  </div>
                  <p>
                    Clients onboarded without a portal invoice (<span className="font-mono text-slate-600">invoiceId IS NULL</span>). Uses their stored <span className="font-mono text-slate-800 font-semibold">amountPaid</span> normalized to INR via live/approximate rates.
                  </p>
                </div>
                <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-[#E8DDD0]">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#1C1812] text-[#B8935B] text-[10px] font-black flex items-center justify-center">C</span>
                    Manual Ripple Nexus Clients
                  </div>
                  <p>
                    RN agency engagements tracked directly. Excludes duplicate invoices by linking records to prevent double-counting across the flywheel.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Tab Switcher & Search Bar ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
              
              {/* Segmented Control */}
              <div className="inline-flex p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-inner w-fit">
                <button
                  onClick={() => setActiveTab('revenue')}
                  className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'revenue'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>💰</span>
                  <span>Revenue Records</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                    {data.summary.invoiceCount + data.summary.manualCareerCount + data.summary.manualRnCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('nps')}
                  className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'nps'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>⭐</span>
                  <span>NPS &amp; Feedback</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                    {data.summary.feedbackCount}
                  </span>
                </button>
              </div>

              {/* Filters (only for revenue tab) */}
              {activeTab === 'revenue' && (
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Search box */}
                  <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                      type="text"
                      placeholder="Search client, email, invoice #…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B] focus:border-transparent transition-all shadow-xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Currency selector */}
                  <select
                    value={selectedCurrency}
                    onChange={e => setSelectedCurrency(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B8935B] shadow-xs"
                  >
                    {availableCurrencies.map(c => (
                      <option key={c} value={c}>{c === 'ALL' ? 'All Currencies' : c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── TAB 1: REVENUE SOURCES ── */}
            {activeTab === 'revenue' && (
              <div className="space-y-8">
                
                {/* 1. Portal Invoices Table */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>📄</span> Source A: Portal Invoices (PAID)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Invoices generated and settled through the client portal checkout.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 w-fit">
                      Showing {filteredInvoices.length} of {data.summary.invoiceCount}
                    </span>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[760px] lg:min-w-full">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 sm:px-6 py-3.5">Invoice #</th>
                          <th className="px-4 py-3.5">Client &amp; Contact</th>
                          <th className="px-4 py-3.5">Currency</th>
                          <th className="px-4 py-3.5 text-right">Total Paid</th>
                          <th className="px-4 py-3.5 text-right">Net Subtotal</th>
                          <th className="px-4 py-3.5 text-right">Net in INR</th>
                          <th className="px-4 py-3.5">Date Paid</th>
                          <th className="px-4 sm:px-6 py-3.5 text-center">Gateway</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                        {filteredInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#FBF8F3]/50 transition-colors group">
                            <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                              <Link
                                href={`/invoices/${inv.id}`}
                                className="font-mono font-bold text-[#B8935B] hover:text-[#9A7540] hover:underline flex items-center gap-1.5"
                              >
                                {inv.invoiceNumber}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">↗</span>
                              </Link>
                              {inv.isRecent && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">
                                  LAST 30D
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{inv.clientName}</div>
                              <div className="text-xs text-slate-400 truncate max-w-[200px]">{inv.clientEmail}</div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {inv.currency}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                              {inv.currencySymbol}{inv.totalPayable.toLocaleString()}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="font-semibold text-slate-800">
                                {inv.currencySymbol}{inv.subtotalConverted.toLocaleString()}
                              </div>
                              {inv.processingFeeConverted > 0 && (
                                <div className="text-[10px] text-slate-400">
                                  fee: {inv.currencySymbol}{inv.processingFeeConverted.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                {fmtInr(inv.netInr)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                              {fmtDate(inv.paidAt)}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-center whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                inv.paymentGateway === 'PAYPAL'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                {inv.paymentGateway ?? 'RAZORPAY'}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {filteredInvoices.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              No paid invoices match your current search or currency filter.
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {filteredInvoices.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs sm:text-sm text-slate-800">
                            <td colSpan={5} className="px-4 sm:px-6 py-3.5">
                              Filtered Total ({filteredInvoices.length} invoices)
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-emerald-700 text-sm sm:text-base">
                              {fmtInr(filteredInvoices.reduce((s, i) => s + i.netInr, 0))}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* 2. Manual Onboarding Clients Table */}
                {(data.manualCareer.length > 0 || data.manualRn.length > 0) && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>👤</span> Sources B &amp; C: Manual Direct Onboardings
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Clients registered directly without a portal invoice ID.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 w-fit">
                        {filteredManualClients.length} Records
                      </span>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse min-w-[640px] lg:min-w-full">
                        <thead>
                          <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <th className="px-4 sm:px-6 py-3.5">Client Name</th>
                            <th className="px-4 py-3.5">Service Stream</th>
                            <th className="px-4 py-3.5 text-right">Amount Recorded</th>
                            <th className="px-4 py-3.5 text-right">Net in INR</th>
                            <th className="px-4 sm:px-6 py-3.5">Onboarding Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                          {filteredManualClients.map((c) => (
                            <tr key={c.id} className="hover:bg-[#FBF8F3]/50 transition-colors">
                              <td className="px-4 sm:px-6 py-3.5">
                                <div className="font-bold text-slate-900">{c.name}</div>
                                <div className="text-xs text-slate-400">{c.email}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  c.source === 'career_manual'
                                    ? 'bg-[#F0EAE0] text-[#9A7540] border border-[#E8DDD0]'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                  {c.source === 'career_manual' ? 'Career Booster Package' : 'Ripple Nexus'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                {c.currency} {c.amountPaid.toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                  {fmtInr(c.inrEquivalent)}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                                {fmtDate(c.createdAt)}
                              </td>
                            </tr>
                          ))}

                          {filteredManualClients.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-10 text-center text-slate-400">
                                No manual clients match your filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── TAB 2: NPS & CLIENT SATISFACTION ── */}
            {activeTab === 'nps' && (
              <div className="space-y-6">

                {/* NPS Computation Breakdown Bar */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Net Promoter Score (NPS) Distribution</h3>
                      <p className="text-xs text-slate-400">Formula: % Promoters (9–10) minus % Detractors (0–6)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-900">{data.summary.lifetimeNps ?? '—'}</span>
                      <span className="text-xs text-slate-400 font-bold">/ 100</span>
                    </div>
                  </div>

                  {data.summary.feedbackCount > 0 ? (
                    <div>
                      {/* Segmented multi-color bar */}
                      <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
                        <div
                          style={{ width: `${(data.summary.promoters / data.summary.feedbackCount) * 100}%` }}
                          className="bg-emerald-500 h-full transition-all"
                          title={`Promoters: ${data.summary.promoters}`}
                        />
                        <div
                          style={{ width: `${(data.summary.passives / data.summary.feedbackCount) * 100}%` }}
                          className="bg-amber-400 h-full transition-all"
                          title={`Passives: ${data.summary.passives}`}
                        />
                        <div
                          style={{ width: `${(data.summary.detractors / data.summary.feedbackCount) * 100}%` }}
                          className="bg-rose-500 h-full transition-all"
                          title={`Detractors: ${data.summary.detractors}`}
                        />
                      </div>

                      {/* Legend */}
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                          <div className="font-extrabold text-emerald-800 text-sm">{data.summary.promoters}</div>
                          <div className="text-emerald-700 font-medium text-[11px]">Promoters (9–10)</div>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
                          <div className="font-extrabold text-amber-800 text-sm">{data.summary.passives}</div>
                          <div className="text-amber-700 font-medium text-[11px]">Passives (7–8)</div>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                          <div className="font-extrabold text-rose-800 text-sm">{data.summary.detractors}</div>
                          <div className="text-rose-700 font-medium text-[11px]">Detractors (0–6)</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-sm">
                      No feedback submitted yet.
                    </div>
                  )}
                </div>

                {/* Feedback Ledger */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        All Client Reviews &amp; Category Scores ({data.feedbacks.length})
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Client names, IDs, ratings, and multi-line feedback comments.
                      </p>
                    </div>
                  </div>

                  {/* 1. Mobile Cards View (< md screens) */}
                  <div className="block md:hidden divide-y divide-slate-100 p-3.5 sm:p-4 space-y-4">
                    {data.feedbacks.map((fb) => {
                      const clientName = fb.careerClient?.name || fb.rnClient?.name || 'Anonymous Client';
                      const clientEmail = fb.careerClient?.email || fb.rnClient?.email || '';
                      const clientId = fb.careerClientId || fb.rnClientId || fb.id;
                      const initial = clientName.charAt(0).toUpperCase() || 'C';

                      return (
                        <div key={fb.id} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                          {/* Header: Client info with Avatar + Rating */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                {initial}
                              </div>
                              <div>
                                <div className="font-extrabold text-sm text-slate-900">{clientName}</div>
                                {clientEmail && (
                                  <a href={`mailto:${clientEmail}`} className="text-xs text-slate-500 hover:text-[#B8935B] truncate block max-w-[180px]">
                                    {clientEmail}
                                  </a>
                                )}
                                <div className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5">
                                  <span>ID:</span>
                                  <span className="truncate max-w-[120px]">{clientId}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70 text-xs shadow-xs">
                                ★ {fb.rating}.0
                              </span>
                              <div className="mt-1.5">
                                <NpsBadge score={fb.npsScore} />
                              </div>
                            </div>
                          </div>

                          {/* Service & Date */}
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#B8935B]/10 text-[#7A5B2E] border border-[#B8935B]/25">
                              {fb.serviceType}
                            </span>
                            <span className="text-slate-400 font-medium">{fmtDate(fb.createdAt)}</span>
                          </div>

                          {/* Category Scores */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/60">
                              <div className="text-[10px] text-slate-400 font-medium">Comm.</div>
                              <div className="font-mono font-bold text-slate-800 mt-0.5">{fb.communication}/5</div>
                            </div>
                            <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/60">
                              <div className="text-[10px] text-slate-400 font-medium">Quality</div>
                              <div className="font-mono font-bold text-slate-800 mt-0.5">{fb.deliveryQuality}/5</div>
                            </div>
                            <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/60">
                              <div className="text-[10px] text-slate-400 font-medium">Speed</div>
                              <div className="font-mono font-bold text-slate-800 mt-0.5">{fb.turnaroundTime}/5</div>
                            </div>
                          </div>

                          {/* Comment box */}
                          {fb.comments ? (
                            <div className="p-3.5 bg-[#FDFBF7] rounded-xl border border-[#EBE3D5] text-xs text-slate-800 leading-relaxed shadow-xs">
                              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#7A5B2E] mb-1">
                                <span>💬</span> Client Feedback
                              </div>
                              <div className="italic text-slate-700 max-h-36 overflow-y-auto pr-1">
                                &ldquo;{fb.comments}&rdquo;
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic py-1">No written testimonial provided</div>
                          )}
                        </div>
                      );
                    })}

                    {data.feedbacks.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        No client feedback submissions recorded in database.
                      </div>
                    )}
                  </div>

                  {/* 2. Desktop & Big Screen Table View (>= md screens) */}
                  <div className="hidden md:block overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[960px] lg:min-w-full">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                          <th className="px-5 py-3.5 min-w-[220px]">Client &amp; ID</th>
                          <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                          <th className="px-4 py-3.5 whitespace-nowrap">Service</th>
                          <th className="px-4 py-3.5 whitespace-nowrap">NPS Status</th>
                          <th className="px-4 py-3.5 whitespace-nowrap text-center">Overall Rating</th>
                          <th className="px-3 py-3.5 text-center whitespace-nowrap">Comm.</th>
                          <th className="px-3 py-3.5 text-center whitespace-nowrap">Quality</th>
                          <th className="px-3 py-3.5 text-center whitespace-nowrap">Speed</th>
                          <th className="px-5 py-3.5 min-w-[320px] xl:min-w-[420px]">Client Feedback Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                        {data.feedbacks.map((fb) => {
                          const clientName = fb.careerClient?.name || fb.rnClient?.name || 'Anonymous Client';
                          const clientEmail = fb.careerClient?.email || fb.rnClient?.email || '';
                          const clientId = fb.careerClientId || fb.rnClientId || fb.id;
                          const initial = clientName.charAt(0).toUpperCase() || 'C';

                          return (
                            <tr key={fb.id} className="hover:bg-[#FBF8F3]/50 transition-colors">
                              {/* Client Avatar + Details */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white flex items-center justify-center font-extrabold text-xs shadow-xs shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 text-sm truncate max-w-[200px]">{clientName}</div>
                                    {clientEmail && (
                                      <a href={`mailto:${clientEmail}`} className="text-xs text-slate-500 hover:text-[#B8935B] truncate block max-w-[200px]">
                                        {clientEmail}
                                      </a>
                                    )}
                                    <div className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 mt-0.5">
                                      <span>ID:</span>
                                      <span className="truncate max-w-[130px]">{clientId}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap text-slate-500 text-xs">
                                {fmtDate(fb.createdAt)}
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#B8935B]/10 text-[#7A5B2E] border border-[#B8935B]/25">
                                  {fb.serviceType}
                                </span>
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap">
                                <NpsBadge score={fb.npsScore} />
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <span className="font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70 text-xs shadow-xs inline-block">
                                  ★ {fb.rating}.0
                                </span>
                              </td>

                              <td className="px-3 py-4 text-center">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100/90 text-slate-800 font-mono font-bold text-xs border border-slate-200/60">
                                  {fb.communication}/5
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100/90 text-slate-800 font-mono font-bold text-xs border border-slate-200/60">
                                  {fb.deliveryQuality}/5
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100/90 text-slate-800 font-mono font-bold text-xs border border-slate-200/60">
                                  {fb.turnaroundTime}/5
                                </span>
                              </td>

                              {/* Comment Quote Block */}
                              <td className="px-5 py-4">
                                {fb.comments ? (
                                  <div className="text-slate-800 italic bg-[#FDFBF7] px-3.5 py-2.5 rounded-xl border border-[#EBE3D5] leading-relaxed max-h-28 overflow-y-auto shadow-xs text-xs">
                                    &ldquo;{fb.comments}&rdquo;
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs italic">— No comment —</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {data.feedbacks.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              No client feedback submissions recorded in database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </AppShell>
  );
}
