'use client';

import React, { useState, useEffect, useCallback } from 'react';

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
  avgGapPct: number | null;
  byGateway: { gateway: string; netInr: number; settledInr: number; gapInr: number; effectiveFeeRate: number; count: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Settlement Inline Editor ─────────────────────────────────────────────────
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
    row.settledAt ? row.settledAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
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
      setError('Enter a valid number');
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
    } catch (e) {
      setError('Failed to save. Try again.');
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
        onClick={() => setOpen(o => !o)}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          row.isReconciled
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
        }`}
      >
        {row.isReconciled ? `✓ ${fmt(row.settledInr!)}` : '+ Enter'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
            {/* Header */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Settlement Entry</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{row.ref} · {row.clientName}</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
              </div>
            </div>

            {/* Reference amounts */}
            <div className="p-5 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Invoiced (gross)</p>
                <p className="font-semibold text-slate-700">{fmt(row.grossInr)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Net Revenue</p>
                <p className="font-semibold text-slate-700">{fmt(row.netInr)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Gateway</p>
                <p className="font-medium text-slate-700">{row.gateway}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Currency</p>
                <p className="font-medium text-slate-700">{row.currency}</p>
              </div>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Actual Amount Received (INR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 11750"
                    min={0}
                  />
                </div>
                {gap !== null && (
                  <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${gap > 0 ? 'text-red-600' : gap < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {gap > 0 ? '▼' : gap < 0 ? '▲' : '='}{' '}
                    Fee gap: {fmt(Math.abs(gap))} ({Math.abs(parseFloat(gapPct ?? '0'))}%
                    {gap > 0 ? ' lost to gateway' : ' more than net — check amount'})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Settlement Date</label>
                <input
                  type="date"
                  value={settledAt}
                  onChange={e => setSettledAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Razorpay batch settled on 2026-08-20"
                />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Settlement'}
                </button>
                {row.isReconciled && (
                  <button
                    onClick={() => { setAmount(''); handleSave(); }}
                    className="px-3 py-2.5 text-red-600 border border-red-200 hover:bg-red-50 text-sm rounded-xl transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 text-slate-600 border border-slate-200 hover:bg-slate-50 text-sm rounded-xl transition-colors"
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (filter === 'reconciled') params.set('reconciled', 'yes');
    if (filter === 'unreconciled') params.set('reconciled', 'no');
    const res = await fetch(`/api/admin/reconciliation/dashboard?${params}`);
    const data = await res.json();
    setRows(data.rows);
    setSummary(data.summary);
    setLoading(false);
  }, [from, to, filter]);

  useEffect(() => { loadData(); }, [loadData]);

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
    loadData(); // refresh summary
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(format);
    const params = new URLSearchParams({ format });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/admin/reconciliation/export?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const filteredRows = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.clientName.toLowerCase().includes(q) ||
           r.clientEmail.toLowerCase().includes(q) ||
           r.ref.toLowerCase().includes(q);
  });

  const reconPct = summary
    ? summary.totalTransactions > 0
      ? Math.round((summary.reconciledCount / summary.totalTransactions) * 100)
      : 0
    : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 sm:p-6 lg:p-10 font-sans">
      {/* ── Page Header ── */}
      <div className="mb-8 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100/50 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Zero-Loss Tracker
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Revenue Reconciliation</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Strictly track actual bank settlements against invoiced amounts to detect and eliminate gateway fee leakage.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#B8935B]/5 text-slate-700 hover:text-[#B8935B] text-sm font-medium rounded-xl border border-slate-200 hover:border-[#B8935B]/40 transition-all shadow-sm disabled:opacity-50"
            >
              {exporting === 'pdf' ? (
                <span className="text-[#B8935B]">⏳</span>
              ) : (
                <svg className="w-4 h-4 text-[#B8935B] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              Export PDF
            </button>
            <button
              onClick={() => handleExport('docx')}
              disabled={exporting !== null}
              className="group flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-all shadow-md disabled:opacity-50 active:scale-95"
            >
              {exporting === 'docx' ? (
                <span className="text-[#D4AF7A]">⏳</span>
              ) : (
                <svg className="w-4 h-4 text-[#D4AF7A] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export DOCX
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Cards (Premium Dark) ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Net Revenue',
              value: fmt(summary.totalNetInr),
              sub: `${summary.totalTransactions} transactions`,
              gradient: 'from-[#0F172A] to-[#1E293B]',
              text: 'text-white',
              subText: 'text-slate-400',
              icon: '💰'
            },
            {
              label: 'Total Settled to Bank',
              value: summary.reconciledCount > 0 ? fmt(summary.totalSettledInr) : '—',
              sub: `${summary.reconciledCount}/${summary.totalTransactions} reconciled (${reconPct}%)`,
              gradient: 'from-[#064E3B] to-[#047857]',
              text: 'text-white',
              subText: 'text-emerald-200/70',
              icon: '🏦'
            },
            {
              label: 'Gateway Fee Leakage',
              value: summary.reconciledCount > 0 ? fmt(summary.totalGapInr) : '—',
              sub: summary.avgGapPct !== null ? `avg ${summary.avgGapPct}% leakage rate` : 'No data yet',
              gradient: 'from-[#7F1D1D] to-[#B91C1C]',
              text: 'text-white',
              subText: 'text-red-200/70',
              icon: '⚠️'
            },
            {
              label: 'Unreconciled Action',
              value: summary.unreconciledCount.toString(),
              sub: 'Require manual settlement entry',
              gradient: 'from-amber-400 to-amber-500',
              text: 'text-amber-950',
              subText: 'text-amber-900/70',
              icon: '⏳'
            },
          ].map((card, i) => (
            <div key={card.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-6 shadow-lg border border-white/10 group hover:-translate-y-1 transition-transform duration-300`}>
              <div className="absolute -right-4 -top-4 text-6xl opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">{card.icon}</div>
              <p className={`text-xs font-semibold tracking-wider uppercase mb-2 ${card.text === 'text-white' ? 'text-white/70' : 'text-amber-900/60'}`}>{card.label}</p>
              <p className={`text-3xl font-bold tracking-tight ${card.text}`}>{card.value}</p>
              <p className={`text-xs font-medium mt-2 ${card.subText}`}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Gateway Breakdown ── */}
      {summary && summary.byGateway.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="font-semibold text-slate-800 text-lg">Fee Leakage by Gateway</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-md uppercase tracking-wider">Analysis</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {summary.byGateway.map(gw => (
              <div key={gw.gateway} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-colors group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-slate-900 text-base">{gw.gateway}</span>
                  <span className="text-xs bg-[#B8935B]/10 text-[#B8935B] px-2.5 py-1 rounded-full font-semibold shadow-sm group-hover:bg-[#B8935B] group-hover:text-white transition-colors">
                    {gw.effectiveFeeRate}% fee
                  </span>
                </div>
                <div className="text-sm space-y-2 text-slate-600 font-medium">
                  <div className="flex justify-between items-center"><span className="text-slate-500">Net revenue</span><span className="text-slate-900 font-medium">{fmt(gw.netInr)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">Settled to bank</span><span className="text-emerald-600 font-medium">{fmt(gw.settledInr)}</span></div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/60"><span className="text-slate-500">Lost to fees</span><span className="text-[#B8935B] font-medium">{fmt(gw.gapInr)}</span></div>
                </div>
                {/* Progress bar */}
                <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF7A] to-[#B8935B] rounded-full"
                    style={{ width: `${Math.min(gw.effectiveFeeRate * 10, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-2 mb-4 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, email or ref…"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-600"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-600"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as 'all' | 'reconciled' | 'unreconciled')}
          className="px-4 py-2.5 bg-slate-900 text-white border-transparent rounded-xl text-sm font-semibold focus:outline-none cursor-pointer hover:bg-slate-800 transition-colors"
        >
          <option value="all">All Transactions</option>
          <option value="reconciled">Reconciled Only</option>
          <option value="unreconciled">Needs Entry</option>
        </select>
      </div>

      {/* ── Transaction Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Loading transactions…</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs mt-1">Adjust your filters or date range</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Gateway</th>
                    <th className="px-4 py-3 text-right font-medium">Gross</th>
                    <th className="px-4 py-3 text-right font-medium">Net</th>
                    <th className="px-4 py-3 text-right font-medium">Settled</th>
                    <th className="px-4 py-3 text-right font-medium">Gap</th>
                    <th className="px-4 py-3 text-center font-medium">Fee %</th>
                    <th className="px-4 py-3 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(row => (
                    <tr key={row.rowId} className={`hover:bg-slate-50 transition-colors ${!row.isReconciled ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-slate-800">{row.ref}</span>
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                          row.type === 'invoice' ? 'bg-blue-50 text-blue-600' :
                          row.type === 'career_manual' ? 'bg-purple-50 text-purple-600' :
                          'bg-teal-50 text-teal-600'
                        }`}>
                          {row.type === 'invoice' ? 'Portal' : row.type === 'career_manual' ? 'Career' : 'RN'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 text-xs">{row.clientName}</div>
                        <div className="text-slate-400 text-xs">{row.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(row.date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.gateway}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">{fmt(row.grossInr)}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-slate-700">{fmt(row.netInr)}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-emerald-700">
                        {row.settledInr !== null ? fmt(row.settledInr) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {row.gapInr !== null ? (
                          <span className={row.gapInr > 0 ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                            {row.gapInr > 0 ? '-' : '+'}{fmt(Math.abs(row.gapInr))}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.gapPct !== null ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            row.gapPct > 3 ? 'bg-red-50 text-red-600' :
                            row.gapPct > 1 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>{row.gapPct}%</span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SettlementEditor row={row} onSaved={handleSaved} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredRows.map(row => (
                <div key={row.rowId} className={`p-4 ${!row.isReconciled ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-800">{row.ref}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          row.type === 'invoice' ? 'bg-blue-50 text-blue-600' :
                          row.type === 'career_manual' ? 'bg-purple-50 text-purple-600' :
                          'bg-teal-50 text-teal-600'
                        }`}>
                          {row.type === 'invoice' ? 'Portal' : row.type === 'career_manual' ? 'Career' : 'RN'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-800 mt-0.5">{row.clientName}</div>
                      <div className="text-xs text-slate-400">{fmtDate(row.date)} · {row.gateway}</div>
                    </div>
                    <SettlementEditor row={row} onSaved={handleSaved} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-slate-400">Net</div>
                      <div className="font-semibold text-slate-700">{fmt(row.netInr)}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="text-emerald-500">Settled</div>
                      <div className="font-semibold text-emerald-700">{row.settledInr !== null ? fmt(row.settledInr) : '—'}</div>
                    </div>
                    <div className={`rounded-lg p-2 ${row.gapInr !== null && row.gapInr > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <div className={row.gapInr !== null && row.gapInr > 0 ? 'text-red-400' : 'text-slate-400'}>Gap</div>
                      <div className={`font-semibold ${row.gapInr !== null && row.gapInr > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {row.gapInr !== null ? fmt(Math.abs(row.gapInr)) : '—'}
                        {row.gapPct !== null ? ` (${row.gapPct}%)` : ''}
                      </div>
                    </div>
                  </div>
                  {row.settlementNote && (
                    <p className="mt-2 text-xs text-slate-400 italic">{row.settlementNote}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        {!loading && filteredRows.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            Showing {filteredRows.length} transaction{filteredRows.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </div>
        )}
      </div>
    </div>
  );
}
