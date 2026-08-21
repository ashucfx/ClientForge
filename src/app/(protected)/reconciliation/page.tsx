'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { IconTrendUp, IconTrendDown, IconCheck, IconAlert } from '@/components/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReconRow {
  rowId: string;
  type: 'invoice' | 'career_manual' | 'rn_manual';
  ref: string;
  clientName: string;
  clientEmail: string;
  gateway: string;
  brand: string;
  currency: string;
  grossInr: number;
  netInr: number;
  feeInr: number;
  settledInr: number | null;
  gapInr: number | null;
  gapPct: number | null;
  date: string | null;
  settlementNote: string | null;
  settledAt: string | null;
  isReconciled: boolean;
}

interface Summary {
  totalTransactions: number;
  reconciledCount: number;
  unreconciledCount: number;
  totalGrossInr: number;
  totalNetInr: number;
  totalSettledInr: number;
  totalGapInr: number;
  allTimeTotalGapInr?: number;
  avgGapPct: number | null;
  byGateway: { gateway: string; netInr: number; settledInr: number; gapInr: number; effectiveFeeRate: number; count: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Settlement Inline Editor Modal ───────────────────────────────────────────
function SettlementEditor({
  row,
  onSaved,
}: {
  row: ReconRow;
  onSaved: (rowId: string, data: { settledInr: number | null; note: string; settledAt: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(row.settledInr?.toString() ?? '');
  const [note, setNote] = useState(row.settlementNote ?? '');
  const [settledAt, setSettledAt] = useState(
    row.settledAt ? row.settledAt.slice(0, 10) : (row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const endpoint =
    row.type === 'invoice'
      ? `/api/admin/invoices/${row.rowId}/settle`
      : row.type === 'career_manual'
      ? `/api/admin/career/${row.rowId}/settle`
      : `/api/admin/rn/${row.rowId}/settle`;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const parsed = parseFloat(amount);
    if (amount !== '' && isNaN(parsed)) {
      setError('Enter a valid numerical amount');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSettledInr: amount === '' ? null : parsed,
          settlementNote: note || null,
          settledAt: settledAt || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSaved(row.rowId, { settledInr: amount === '' ? null : parsed, note, settledAt });
      setOpen(false);
    } catch {
      setError('Failed to save settlement record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const gap = amount !== '' && !isNaN(parseFloat(amount))
    ? row.netInr - parseFloat(amount)
    : null;
  const gapPct = gap !== null && row.netInr > 0
    ? ((gap / row.netInr) * 100).toFixed(1)
    : null;

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-95 ${
          row.isReconciled
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300'
            : 'bg-amber-500 text-white hover:bg-amber-600 border border-amber-600'
        }`}
      >
        {row.isReconciled ? (
          <>
            <IconCheck size={12} className="text-emerald-600" />
            <span>{fmt(row.settledInr!)}</span>
          </>
        ) : (
          <>
            <span>+ Settle</span>
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#D4AF7A] font-semibold uppercase tracking-wider mb-1">
                  <span>Bank Settlement Entry</span>
                  <span>•</span>
                  <span className="font-mono text-white/80">{row.ref}</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">{row.clientName}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{row.clientEmail}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Reference Breakdown Cards */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <span className="text-slate-400 block font-medium">Invoiced Gross</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">{fmt(row.grossInr)}</span>
                <span className="text-[10px] text-slate-400 font-mono">{row.currency}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <span className="text-slate-400 block font-medium">Expected Net</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{fmt(row.netInr)}</span>
                <span className="text-[10px] text-emerald-600 font-medium">0% Loss Target</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <span className="text-slate-400 block font-medium">Gateway</span>
                <span className="text-xs font-bold text-slate-700 mt-1 block uppercase">{row.gateway}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <span className="text-slate-400 block font-medium">Invoice Date</span>
                <span className="text-xs font-semibold text-slate-700 mt-1 block">{fmtDate(row.date)}</span>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Actual Received in Bank (INR) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(Math.round(row.netInr).toString())}
                    className="text-[11px] font-bold text-[#B8935B] hover:text-[#9A7540] hover:underline"
                  >
                    Auto-Fill Exact Net (₹{Math.round(row.netInr).toLocaleString('en-IN')})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B] focus:border-transparent transition-all shadow-xs"
                    placeholder="e.g. 11750"
                    min={0}
                  />
                </div>
                {gap !== null && (
                  <div className={`mt-2.5 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                    gap > 0
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : gap < 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {gap > 0 ? '⚠️ Fee Loss:' : '✓ Zero Leakage:'}
                      <span>{fmt(Math.abs(gap))} ({Math.abs(parseFloat(gapPct ?? '0'))}%)</span>
                    </span>
                    <span className="text-[11px] font-medium opacity-80">
                      {gap > 0 ? 'Lost to gateway fees' : gap < 0 ? 'Surplus / FX Gain' : 'Exact match with expected net'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bank Settlement Date
                </label>
                <input
                  type="date"
                  value={settledAt}
                  onChange={e => setSettledAt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B] transition-all"
                  placeholder="e.g. Razorpay payout batch #98421"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <IconAlert size={14} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-[#B8935B] hover:bg-[#9A7540] disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all shadow-md active:scale-98"
                >
                  {saving ? 'Recording…' : 'Save Settlement'}
                </button>
                {row.isReconciled && (
                  <button
                    onClick={() => { setAmount(''); handleSave(); }}
                    disabled={saving}
                    className="px-4 py-3 text-rose-600 border border-rose-200 hover:bg-rose-50 text-sm font-bold rounded-2xl transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-3 text-slate-600 border border-slate-200 hover:bg-slate-50 text-sm font-bold rounded-2xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ReconciliationPage() {
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reconciled' | 'unreconciled'>('all');
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  
  // Date states initialized to current month
  const now = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), [now]);
  const currentMonthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10), [now]);
  const currentMonthVal = useMemo(() => now.toISOString().slice(0, 7), [now]);

  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(currentMonthEnd);
  const [monthVal, setMonthVal] = useState(currentMonthVal);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [activePreset, setActivePreset] = useState<'this_month' | 'last_month' | '90d' | 'ytd' | 'all' | 'custom'>('this_month');

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (filter === 'reconciled') params.set('reconciled', 'yes');
    if (filter === 'unreconciled') params.set('reconciled', 'no');
    try {
      const res = await fetch(`/api/admin/reconciliation/dashboard?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setSummary(data.summary || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Preset date filters
  const applyPreset = (preset: 'this_month' | 'last_month' | '90d' | 'ytd' | 'all') => {
    setActivePreset(preset);
    const n = new Date();
    if (preset === 'this_month') {
      const start = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10);
      setFrom(start);
      setTo(end);
      setMonthVal(n.toISOString().slice(0, 7));
    } else if (preset === 'last_month') {
      const prevMonth = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      const start = prevMonth.toISOString().slice(0, 10);
      const end = new Date(n.getFullYear(), n.getMonth(), 0).toISOString().slice(0, 10);
      setFrom(start);
      setTo(end);
      setMonthVal(prevMonth.toISOString().slice(0, 7));
    } else if (preset === '90d') {
      const past = new Date(n.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = n.toISOString().slice(0, 10);
      setFrom(past);
      setTo(today);
      setMonthVal('');
    } else if (preset === 'ytd') {
      const start = new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const today = n.toISOString().slice(0, 10);
      setFrom(start);
      setTo(today);
      setMonthVal('');
    } else if (preset === 'all') {
      setFrom('');
      setTo('');
      setMonthVal('');
    }
  };

  const handleSaved = (rowId: string, data: { settledInr: number | null; note: string; settledAt: string }) => {
    setRows(prev => prev.map(r => {
      if (r.rowId !== rowId) return r;
      const newSettled = data.settledInr;
      const gapInr = newSettled !== null ? r.netInr - newSettled : null;
      const gapPct = gapInr !== null && r.netInr > 0 ? Math.round((gapInr / r.netInr) * 1000) / 10 : null;
      return {
        ...r,
        settledInr: newSettled,
        settlementNote: data.note,
        settledAt: data.settledAt,
        gapInr,
        gapPct,
        isReconciled: newSettled !== null,
      };
    }));
    loadData();
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(format);
    const params = new URLSearchParams({ format });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const res = await fetch(`/api/admin/reconciliation/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconciliation-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(null);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (gatewayFilter !== 'all' && r.gateway.toLowerCase() !== gatewayFilter.toLowerCase()) {
        return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return r.clientName.toLowerCase().includes(q) ||
             r.clientEmail.toLowerCase().includes(q) ||
             r.ref.toLowerCase().includes(q) ||
             r.gateway.toLowerCase().includes(q);
    });
  }, [rows, search, gatewayFilter]);

  const reconPct = summary
    ? summary.totalTransactions > 0
      ? Math.round((summary.reconciledCount / summary.totalTransactions) * 100)
      : 0
    : 0;

  return (
    <AppShell>
      <div className="w-full max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 animate-fadeIn">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B8935B]/10 text-[#B8935B] text-xs font-extrabold uppercase tracking-wider mb-2 border border-[#B8935B]/20">
              <span className="w-2 h-2 rounded-full bg-[#B8935B] animate-pulse" />
              <span>Zero-Loss Reconciliation Ledger</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Revenue Reconciliation
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Audit actual bank settlements against invoiced net amounts to eliminate gateway fee leakage and ensure zero revenue loss.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => loadData()}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh ledger data"
            >
              🔄
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#B8935B]/5 text-slate-700 hover:text-[#B8935B] text-xs sm:text-sm font-bold rounded-xl border border-slate-200 hover:border-[#B8935B]/40 transition-all shadow-2xs disabled:opacity-50"
            >
              {exporting === 'pdf' ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <svg className="w-4 h-4 text-[#B8935B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              Export PDF
            </button>
            <button
              onClick={() => handleExport('docx')}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {exporting === 'docx' ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <svg className="w-4 h-4 text-[#D4AF7A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export DOCX
            </button>
          </div>
        </div>

        {/* ── Summary KPI Cards (Premium Modern) ── */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Net Revenue */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#2D2418] text-white p-5 sm:p-6 shadow-md border border-[#B8935B]/30 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF7A]">Expected Net Revenue</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#B8935B]/20 text-[#D4AF7A] border border-[#B8935B]/30">
                  {summary.totalTransactions} Deals
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                  {fmt(summary.totalNetInr)}
                </div>
                <div className="text-xs text-slate-300">
                  Gross: {fmt(summary.totalGrossInr)}
                </div>
              </div>
            </div>

            {/* Bank Settled */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Settled Revenue</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  {reconPct}% Settled
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 mb-1">
                  {fmt(summary.totalSettledInr)}
                </div>
                <div className="text-xs text-slate-500">
                  {summary.reconciledCount} of {summary.totalTransactions} transactions verified
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(reconPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Fee Leakage */}
            <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between border ${
              summary.totalGapInr > 0
                ? 'bg-rose-50/40 border-rose-200/80 text-rose-950'
                : 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {(from || to) ? 'Period Fee Leakage' : 'All-Time Leakage'}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  summary.totalGapInr > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {summary.totalGapInr > 0 ? `${summary.avgGapPct ?? 0}% loss` : '0% Leakage'}
                </span>
              </div>
              <div>
                <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 ${
                  summary.totalGapInr > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {fmt(summary.totalGapInr)}
                </div>
                <div className="text-xs text-slate-500">
                  {(from || to) && summary.allTimeTotalGapInr !== undefined
                    ? `All-Time Gap: ${fmt(summary.allTimeTotalGapInr)}`
                    : 'Target: ₹0 gateway fee loss'}
                </div>
              </div>
            </div>

            {/* Action Required */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unreconciled Action</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  summary.unreconciledCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {summary.unreconciledCount > 0 ? 'Needs Entry' : 'All Clear'}
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
                  {summary.unreconciledCount}
                </div>
                <button
                  onClick={() => setFilter('unreconciled')}
                  className="text-xs font-bold text-[#B8935B] hover:text-[#9A7540] hover:underline"
                >
                  Filter pending settlements →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Gateway Breakdown Cards ── */}
        {summary && summary.byGateway.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 mb-8 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>⚡</span>
                  <span>Gateway Fee Leakage Breakdown</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Realized fee deductions by payment channel</p>
              </div>
              {gatewayFilter !== 'all' && (
                <button
                  onClick={() => setGatewayFilter('all')}
                  className="text-xs font-bold text-[#B8935B] hover:underline"
                >
                  Clear Gateway Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summary.byGateway.map(gw => (
                <div
                  key={gw.gateway}
                  onClick={() => setGatewayFilter(prev => prev === gw.gateway ? 'all' : gw.gateway)}
                  className={`border rounded-2xl p-5 cursor-pointer transition-all duration-200 ${
                    gatewayFilter.toLowerCase() === gw.gateway.toLowerCase()
                      ? 'border-[#B8935B] bg-[#B8935B]/5 shadow-sm'
                      : 'border-slate-200/70 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-900 text-sm uppercase tracking-wide">{gw.gateway}</span>
                    <span className="text-xs bg-[#B8935B]/15 text-[#9A7540] px-2.5 py-0.5 rounded-full font-bold">
                      {gw.effectiveFeeRate}% fee
                    </span>
                  </div>
                  <div className="text-xs space-y-2 text-slate-600 font-medium">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Net expected</span>
                      <span className="text-slate-800 font-bold">{fmt(gw.netInr)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Settled to bank</span>
                      <span className="text-emerald-600 font-bold">{fmt(gw.settledInr)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="text-slate-400">Fee gap / loss</span>
                      <span className={`font-bold ${gw.gapInr > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {fmt(gw.gapInr)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B8935B] rounded-full"
                      style={{ width: `${Math.min(gw.effectiveFeeRate * 15, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters & Controls ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 mb-6 shadow-xs space-y-3">
          
          {/* Preset Buttons & Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">Period:</span>
            <button
              onClick={() => applyPreset('this_month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                activePreset === 'this_month' ? 'bg-[#B8935B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => applyPreset('last_month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                activePreset === 'last_month' ? 'bg-[#B8935B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => applyPreset('90d')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                activePreset === '90d' ? 'bg-[#B8935B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last 90 Days
            </button>
            <button
              onClick={() => applyPreset('ytd')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                activePreset === 'ytd' ? 'bg-[#B8935B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Year to Date
            </button>
            <button
              onClick={() => applyPreset('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                activePreset === 'all' ? 'bg-[#B8935B] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">Status:</span>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                  filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({summary?.totalTransactions ?? 0})
              </button>
              <button
                onClick={() => setFilter('reconciled')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                  filter === 'reconciled' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Reconciled ({summary?.reconciledCount ?? 0})
              </button>
              <button
                onClick={() => setFilter('unreconciled')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                  filter === 'unreconciled' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Needs Entry ({summary?.unreconciledCount ?? 0})
              </button>
            </div>
          </div>

          {/* Search and Date Inputs */}
          <div className="flex flex-col md:flex-row items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex-1 w-full relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search client name, email, invoice reference, or gateway…"
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B] transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="month"
                value={monthVal}
                onChange={e => {
                  const val = e.target.value;
                  setMonthVal(val);
                  setActivePreset('custom');
                  if (!val) { setFrom(''); setTo(''); return; }
                  const [y, m] = val.split('-');
                  setFrom(new Date(parseInt(y), parseInt(m) - 1, 1).toISOString().slice(0, 10));
                  setTo(new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10));
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B] transition-all shrink-0"
                title="Select Specific Month"
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="date"
                  value={from}
                  onChange={e => { setFrom(e.target.value); setActivePreset('custom'); }}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B]"
                  title="Start Date"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="date"
                  value={to}
                  onChange={e => { setTo(e.target.value); setActivePreset('custom'); }}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#B8935B]"
                  title="End Date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Transaction Table ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="w-10 h-10 border-4 border-[#B8935B]/20 border-t-[#B8935B] rounded-full animate-spin" />
              <p className="text-xs sm:text-sm font-medium text-slate-500">Querying reconciled settlements…</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm font-bold text-slate-700">No transactions match your criteria</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing filters or adjusting your date range</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Reference</th>
                      <th className="px-5 py-3.5">Client</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Gateway</th>
                      <th className="px-5 py-3.5 text-right">Gross</th>
                      <th className="px-5 py-3.5 text-right">Expected Net</th>
                      <th className="px-5 py-3.5 text-right">Bank Settled</th>
                      <th className="px-5 py-3.5 text-right">Fee Gap</th>
                      <th className="px-5 py-3.5 text-center">Fee %</th>
                      <th className="px-5 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map(row => (
                      <tr
                        key={row.rowId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !row.isReconciled ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">{row.ref}</span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              row.type === 'invoice'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : row.type === 'career_manual'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                                : 'bg-teal-50 text-teal-700 border border-teal-200/60'
                            }`}>
                              {row.type === 'invoice' ? 'Portal' : row.type === 'career_manual' ? 'Career' : 'RN'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900 text-xs">{row.clientName}</div>
                          <div className="text-slate-400 text-[11px]">{row.clientEmail}</div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                          {fmtDate(row.date)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                            {row.gateway}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-slate-500">
                          {fmt(row.grossInr)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {fmt(row.netInr)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-600">
                          {row.settledInr !== null ? fmt(row.settledInr) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          {row.gapInr !== null ? (
                            <span className={row.gapInr > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {row.gapInr > 0 ? '-' : '+'}{fmt(Math.abs(row.gapInr))}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {row.gapPct !== null ? (
                            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              row.gapPct > 3
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : row.gapPct > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {row.gapPct}%
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <SettlementEditor row={row} onSaved={handleSaved} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (<1024px) */}
              <div className="lg:hidden divide-y divide-slate-100">
                {filteredRows.map(row => (
                  <div key={row.rowId} className={`p-4 sm:p-5 ${!row.isReconciled ? 'bg-amber-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900">{row.ref}</span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            row.type === 'invoice' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {row.gateway}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{row.clientName}</h4>
                        <p className="text-xs text-slate-400">{fmtDate(row.date)} · {row.clientEmail}</p>
                      </div>
                      <SettlementEditor row={row} onSaved={handleSaved} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected Net</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{fmt(row.netInr)}</span>
                      </div>
                      <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase block">Bank Settled</span>
                        <span className="font-bold text-emerald-700 mt-0.5 block">
                          {row.settledInr !== null ? fmt(row.settledInr) : '—'}
                        </span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${
                        row.gapInr !== null && row.gapInr > 0
                          ? 'bg-rose-50 border-rose-100 text-rose-700'
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`}>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Fee Gap</span>
                        <span className="font-bold mt-0.5 block">
                          {row.gapInr !== null ? fmt(Math.abs(row.gapInr)) : '—'}
                          {row.gapPct !== null ? ` (${row.gapPct}%)` : ''}
                        </span>
                      </div>
                    </div>

                    {row.settlementNote && (
                      <p className="mt-2.5 text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                        📝 {row.settlementNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Table Footer */}
          {!loading && filteredRows.length > 0 && (
            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/80 text-xs font-semibold text-slate-500 flex items-center justify-between">
              <span>
                Showing {filteredRows.length} of {rows.length} transaction{rows.length !== 1 ? 's' : ''}
              </span>
              <span className="text-slate-400 font-normal">
                {search ? `Filtered by "${search}"` : 'Real-time ledger entries'}
              </span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
