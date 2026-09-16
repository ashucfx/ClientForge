'use client';
// src/app/(protected)/invoices/page.tsx — Dedicated Invoicing Registry Suite

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, ClientType, InvoiceStatus } from '@/types';
import { formatCurrency, CLIENT_TYPE_LABELS } from '@/lib/pricing';
import AppShell from '@/components/AppShell';
import { IconCheck, IconSearch, IconPlus, IconRefresh, IconCopy, IconMail } from '@/components/Icons';

// ─── Status Badge ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  PAID:           { label: 'Paid',           bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  PARTIALLY_PAID: { label: 'Partial',        bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200'   },
  PENDING:        { label: 'Pending',        bg: 'bg-[#FBF8F3]',   text: 'text-[#9A7540]',   dot: 'bg-[#B8935B]',   border: 'border-[#EAE2D5]'   },
  EXPIRED:        { label: 'Expired',        bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400',   border: 'border-slate-200'   },
  CANCELLED:      { label: 'Cancelled',      bg: 'bg-rose-50',     text: 'text-rose-600',     dot: 'bg-rose-400',    border: 'border-rose-200'    },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Tier Tag ─────────────────────────────────────────────────────
const TIER_COLORS: Record<ClientType, string> = {
  FRESHER:        'bg-slate-100 text-slate-700 border-slate-200',
  MID_CAREER:     'bg-[#FBF8F3] text-[#9A7540] border-[#E8DDD0]',
  EXECUTIVE:      'bg-purple-50 text-purple-700 border-purple-200',
  EXECUTIVE_PLUS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  AGENCY_CLIENT:  'bg-slate-100 text-slate-700 border-slate-200',
};

function TierTag({ type }: { type: ClientType }) {
  const label = CLIENT_TYPE_LABELS[type] ?? type;
  const cls   = TIER_COLORS[type] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState<string>('ALL');
  const [currencyFilter, setCurrency] = useState<string>('ALL');
  const [typeFilter, setType] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices?limit=100', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices ?? []);
      }
    } catch {
      setToastMsg('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCopyLink = (inv: InvoiceData, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = inv.paymentGateway === 'PAYPAL' ? inv.paypalPaymentUrl : inv.razorpayLinkUrl;
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Payment link copied to clipboard');
    } else {
      const fullUrl = `${window.location.origin}/invoices/${inv.id}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Invoice link copied to clipboard');
    }
  };

  const handleResend = async (inv: InvoiceData, e: React.MouseEvent) => {
    e.stopPropagation();
    setResendingId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/resend-email`, { method: 'POST' });
      if (res.ok) {
        showToast(`Invoice email dispatched to ${inv.clientEmail}`);
      } else {
        showToast('Failed to resend email');
      }
    } catch {
      showToast('Error sending invoice email');
    } finally {
      setResendingId(null);
    }
  };

  // Distinct currencies
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(i => { if (i.currency) set.add(i.currency); });
    return Array.from(set).sort();
  }, [invoices]);

  // Filtered invoices
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (currencyFilter !== 'ALL' && inv.currency !== currencyFilter) return false;
      if (typeFilter !== 'ALL' && inv.clientType !== typeFilter) return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase().trim();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        (inv.companyName ?? '').toLowerCase().includes(q)
      );
    });
  }, [invoices, statusFilter, currencyFilter, typeFilter, search]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const paidCount = invoices.filter(i => i.status === 'PAID').length;
    const pendingCount = invoices.filter(i => i.status === 'PENDING').length;
    const totalCollectedInr = invoices
      .filter(i => i.status === 'PAID')
      .reduce((acc, i) => acc + (i.amountSettledInr ?? i.totalPayable * (i.exchangeRate || 1)), 0);

    return { totalCount, paidCount, pendingCount, totalCollectedInr };
  }, [invoices]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ['Invoice Number', 'Client Name', 'Client Email', 'Status', 'Package Tier', 'Currency', 'Total Payable', 'Exchange Rate', 'Gateway', 'Created Date'];
    const rows = filtered.map(i => [
      i.invoiceNumber,
      `"${i.clientName.replace(/"/g, '""')}"`,
      i.clientEmail,
      i.status,
      i.clientType,
      i.currency,
      i.totalPayable,
      i.exchangeRate,
      i.paymentGateway,
      format(new Date(i.createdAt), 'yyyy-MM-dd HH:mm'),
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalyst-invoices-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* Toast */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#0A0B0D] text-white px-4 py-3 rounded-xl shadow-xl border border-[#B8935B]/40 text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
            {toastMsg}
          </div>
        )}

        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Financial Suite</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Invoices Registry</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Comprehensive ledger of client billings, gateway links, and settlement tracking.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV</span>
            </button>
            <Link
              href="/invoices/new"
              className="px-4 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <IconPlus size={14} />
              <span>Create Invoice</span>
            </Link>
          </div>
        </div>

        {/* ── Quick Stats Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Invoices</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.totalCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Lifetime records</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Paid Invoices</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.paidCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {stats.totalCount ? Math.round((stats.paidCount / stats.totalCount) * 100) : 0}% settlement rate
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#B8935B]">Pending Collections</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.pendingCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Awaiting gateway settlement</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Settled</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              ₹{Math.round(stats.totalCollectedInr).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Reconciled revenue</div>
          </div>
        </div>

        {/* ── Filters & Search Control ── */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by invoice number, client name, email, company…"
                className="w-full pl-10 pr-9 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 bg-slate-50/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Currency Select */}
            <div className="flex items-center gap-2">
              <select
                value={currencyFilter}
                onChange={e => setCurrency(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-[#B8935B]"
              >
                <option value="ALL">All Currencies</option>
                {availableCurrencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Package Select */}
              <select
                value={typeFilter}
                onChange={e => setType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-[#B8935B]"
              >
                <option value="ALL">All Packages</option>
                <option value="FRESHER">Fresher</option>
                <option value="MID_CAREER">Mid-Career</option>
                <option value="EXECUTIVE">Executive</option>
                <option value="EXECUTIVE_PLUS">Executive Plus</option>
              </select>

              <button
                onClick={fetchInvoices}
                disabled={loading}
                title="Refresh Table"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <IconRefresh size={14} className={loading ? 'animate-spin text-[#B8935B]' : ''} />
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'PAID', label: 'Paid' },
              { id: 'PARTIALLY_PAID', label: 'Partial' },
              { id: 'EXPIRED', label: 'Expired' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ].map(tab => {
              const count = tab.id === 'ALL' ? invoices.length : invoices.filter(i => i.status === tab.id).length;
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#B8935B] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table / Cards View ── */}
        {loading ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs shadow-xs">
            <IconRefresh size={22} className="animate-spin text-[#B8935B] mx-auto mb-3" />
            <span>Loading invoice registry…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="font-bold text-slate-700 text-sm">No matching invoices found</div>
            <div className="text-slate-400 mt-1">Try resetting your filters or search terms.</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#FAF9F6] border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Client</th>
                      <th className="py-3.5 px-4">Package</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Gateway</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(inv => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                        onClick={() => window.location.href = `/invoices/${inv.id}`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 group-hover:text-[#B8935B] transition-colors">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{inv.clientName}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{inv.clientEmail}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <TierTag type={inv.clientType} />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {formatCurrency(inv.totalPayable, inv.currencySymbol)}
                          </div>
                          {inv.currency !== 'INR' && (
                            <div className="text-[10px] text-slate-400">
                              ≈ ₹{Math.round(inv.totalPayable * (inv.exchangeRate || 1)).toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {inv.paymentGateway}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {format(new Date(inv.createdAt), 'dd MMM yyyy')}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={e => handleCopyLink(inv, e)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Copy Payment Link"
                            >
                              {copiedId === inv.id ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                            </button>
                            {inv.status === 'PENDING' && (
                              <button
                                onClick={e => handleResend(inv, e)}
                                disabled={resendingId === inv.id}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                                title="Resend Invoice Email"
                              >
                                <IconMail size={13} className={resendingId === inv.id ? 'animate-pulse text-[#B8935B]' : ''} />
                              </button>
                            )}
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#EAE2D5] text-[#9A7540] hover:bg-[#FBF8F3] text-[11px] font-bold transition-colors"
                            >
                              View →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View (< md) */}
            <div className="block md:hidden space-y-3">
              {filtered.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => window.location.href = `/invoices/${inv.id}`}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">{inv.invoiceNumber}</span>
                      <div className="font-semibold text-sm text-slate-800 mt-0.5">{inv.clientName}</div>
                      <div className="text-xs text-slate-400">{inv.clientEmail}</div>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Payable</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(inv.totalPayable, inv.currencySymbol)}
                      </span>
                    </div>
                    <TierTag type={inv.clientType} />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400" onClick={e => e.stopPropagation()}>
                    <span>{format(new Date(inv.createdAt), 'dd MMM yyyy')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => handleCopyLink(inv, e)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-semibold text-xs flex items-center gap-1"
                      >
                        {copiedId === inv.id ? <IconCheck size={12} className="text-emerald-600" /> : <IconCopy size={12} />}
                        <span>Link</span>
                      </button>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="px-3 py-1 rounded-lg bg-[#B8935B] text-white font-bold text-xs"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
