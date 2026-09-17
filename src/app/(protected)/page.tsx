'use client';
// src/app/page.tsx — Executive Command Center & Overview

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, ClientType, InvoiceStatus } from '@/types';
import { formatCurrency, CLIENT_TYPE_LABELS } from '@/lib/pricing';
import { IconCheck, IconDocument, IconPending, IconSearch, IconTrendUp, IconPlus } from '@/components/Icons';
import AppShell from '@/components/AppShell';

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

interface ReconSummary {
  totalTransactions: number;
  reconciledCount: number;
  unreconciledCount: number;
  totalGrossInr: number;
  totalNetInr: number;
  totalSettledInr: number;
  totalGapInr: number;
  allTimeTotalGapInr?: number;
  avgGapPct: number | null;
}

// ─── Executive KPI Card ───────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`bg-white rounded-2xl p-5 sm:p-6 border transition-all duration-200 shadow-xs flex flex-col justify-between h-full ${
        accent ? 'border-[#B8935B]/40 ring-1 ring-[#B8935B]/15 bg-gradient-to-br from-white to-[#FDFBF7]' : 'border-slate-200/80'
      } ${href ? 'hover:border-[#B8935B]/50 hover:shadow-sm cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] shadow-xs">
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 ${accent ? 'text-[#B8935B]' : 'text-slate-900'}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-slate-400 font-medium truncate">{sub}</div>}
      </div>
    </div>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

export default function Dashboard() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [reconSummary, setReconSummary] = useState<ReconSummary | null>(null);
  const [loading, setLoading]   = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, reconRes] = await Promise.allSettled([
        fetch('/api/invoices?limit=100', { cache: 'no-store' }),
        fetch('/api/admin/reconciliation/dashboard', { cache: 'no-store' }),
      ]);

      if (invRes.status === 'fulfilled' && invRes.value.ok) {
        const data = await invRes.value.json();
        setInvoices(data.invoices ?? []);
      }

      if (reconRes.status === 'fulfilled' && reconRes.value.ok) {
        const reconData = await reconRes.value.json();
        setReconSummary(reconData.summary ?? null);
      }
    } catch (err) {
      console.error('Failed to load dashboard invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Financial Metrics calculations
  const metrics = useMemo(() => {
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(i => i.status === 'PAID');
    const pendingInvoices = invoices.filter(i => i.status === 'PENDING');

    // Currency normalization helper:
    // In Catalyst schema, exchangeRate represents foreign currency units per 1 INR (e.g., 0.012 for USD).
    // Therefore, foreignAmount / exchangeRate converts back to INR.
    const toInr = (amount: number, currency: string, rate?: number | null) => {
      if (!amount || amount === 0) return 0;
      const cur = (currency || 'INR').toUpperCase();
      if (cur === 'INR') return amount;
      if (rate && rate > 0) return amount / rate;
      return amount;
    };

    // Total Settled Revenue: Prefer verified reconciliation ledger sum
    const totalCollectedInr = reconSummary?.totalSettledInr ?? paidInvoices.reduce(
      (sum, i) => sum + (i.amountSettledInr ?? toInr(i.subtotalConverted, i.currency, i.exchangeRate)),
      0
    );

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthCollectedInr = paidInvoices
      .filter(i => {
        const d = new Date(i.paidAt || i.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, i) => sum + (i.amountSettledInr ?? toInr(i.subtotalConverted, i.currency, i.exchangeRate)), 0);

    const pendingReceivablesInr = pendingInvoices.reduce(
      (sum, i) => sum + toInr(i.totalPayable, i.currency, i.exchangeRate),
      0
    );

    // True Settlement Fee Leakage:
    // In Catalyst's zero-loss model, the processing fee is added to totalPayable so the client
    // absorbs the gateway fee. subtotalConverted is the net revenue Catalyst expects to retain.
    // If bank settlement equals or exceeds subtotalConverted, fee leakage is ₹0 (zero loss).
    // Leakage only occurs if bank settlement falls short of the expected net subtotal.
    const fallbackGapInr = invoices.reduce((sum, i) => {
      if (i.amountSettledInr !== null && i.amountSettledInr !== undefined) {
        const expectedNetInr = toInr(i.subtotalConverted, i.currency, i.exchangeRate);
        const gap = expectedNetInr - i.amountSettledInr;
        if (gap > 0) return sum + gap;
      }
      return sum;
    }, 0);

    const totalGapInr = reconSummary?.allTimeTotalGapInr ?? reconSummary?.totalGapInr ?? fallbackGapInr;

    return {
      totalInvoices,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      totalCollectedInr,
      monthCollectedInr,
      pendingReceivablesInr,
      totalGapInr: Math.max(0, totalGapInr),
      recentInvoices: invoices.slice(0, 6),
    };
  }, [invoices, reconSummary]);

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational Command Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Catalyst Overview</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              High-level intelligence on collections, receivables, and client operations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/invoices"
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>View Invoices Registry</span>
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              href="/invoices/new"
              className="px-4 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <IconPlus size={14} />
              <span>Create Invoice</span>
            </Link>
          </div>
        </div>

        {/* ── Executive KPI Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Settled Revenue"
            value={loading ? '…' : `₹${Math.round(metrics.totalCollectedInr).toLocaleString('en-IN')}`}
            sub="Reconciled lifetime bank inflow"
            accent
            href="/reconciliation?reconciled=yes"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Collections This Month"
            value={loading ? '…' : `₹${Math.round(metrics.monthCollectedInr).toLocaleString('en-IN')}`}
            sub={`${format(new Date(), 'MMMM yyyy')} collections`}
            href="/reconciliation"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <KpiCard
            label="Pending Receivables"
            value={loading ? '…' : `₹${Math.round(metrics.pendingReceivablesInr).toLocaleString('en-IN')}`}
            sub={`${metrics.pendingCount} invoices awaiting payment`}
            href="/invoices?status=PENDING"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <KpiCard
            label="Settlement Fee Leakage"
            value={loading ? '…' : `₹${Math.round(metrics.totalGapInr).toLocaleString('en-IN')}`}
            sub={metrics.totalGapInr > 0 ? "Gateway deductions & processing gap" : "Zero revenue loss (100% net match)"}
            href="/reconciliation"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* ── Mid Section: Action Required & Quick Launcher ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Action Required Widget */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Action Required</span>
                </span>
                {metrics.pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    {metrics.pendingCount} Pending
                  </span>
                )}
              </div>

              <div className="py-4">
                {metrics.pendingCount > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {metrics.pendingCount} Outstanding Invoices
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Several client accounts have unpaid invoices awaiting settlement. Review and dispatch reminders directly from the registry.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    All caught up! No overdue actions required.
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/invoices"
              className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all text-center border border-slate-200"
            >
              Manage Outstanding Invoices →
            </Link>
          </div>

          {/* Quick Operations Command Launcher */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
                <span>Executive Command Suite</span>
              </span>
              <span className="text-[11px] text-slate-400">Direct Navigation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: '/invoices', title: 'Invoices Registry', sub: 'Ledger & CSV export', icon: '📄' },
                { href: '/reconciliation', title: 'Reconciliation', sub: 'Bank match & fee gap', icon: '💰' },
                { href: '/career', title: 'Client Accounts', sub: 'Deliverables & CRM', icon: '👥' },
                { href: '/career/kanban', title: 'Kanban Board', sub: 'Workflow pipeline', icon: '📊' },
                { href: '/settings/global-pricing', title: 'Pricing Engine', sub: 'INR & USD rates', icon: '⚙️' },
                { href: '/bugs', title: 'Bug Reports', sub: 'Client issue diagnostics', icon: '🛡️' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-[#B8935B] hover:bg-[#FDFBF7] transition-all group"
                >
                  <div className="text-sm font-bold text-slate-800 group-hover:text-[#B8935B] transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.sub}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Invoices Widget ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Invoices</h2>
              <p className="text-xs text-slate-400 mt-0.5">Most recent client billings and active payment transactions.</p>
            </div>
            <Link
              href="/invoices"
              className="text-xs font-bold text-[#B8935B] hover:text-[#9A7540] flex items-center gap-1 transition-colors"
            >
              <span>View All Invoices in Registry</span>
              <span>→</span>
            </Link>
          </div>

          {/* Mobile card list (< md) */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading recent invoices…</div>
            ) : metrics.recentInvoices.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No invoices found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {metrics.recentInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className="p-4 space-y-2.5 hover:bg-slate-50/70 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/invoices/${inv.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-900 text-sm group-hover:text-[#B8935B]">{inv.invoiceNumber}</div>
                        <div className="font-semibold text-slate-800 text-xs mt-0.5">{inv.clientName}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{inv.clientEmail}</div>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TierTag type={inv.clientType} />
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{inv.paymentGateway}</span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{formatCurrency(inv.totalPayable, inv.currencySymbol)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop table (≥ md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#FAF9F6] border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Payable</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading recent invoices…
                    </td>
                  </tr>
                ) : metrics.recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No invoices found. Click &quot;+ Create Invoice&quot; to issue your first invoice.
                    </td>
                  </tr>
                ) : (
                  metrics.recentInvoices.map(inv => (
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
                        <div className="text-[11px] text-slate-400 truncate max-w-[170px]">{inv.clientEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <TierTag type={inv.clientType} />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(inv.totalPayable, inv.currencySymbol)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {inv.paymentGateway}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#EAE2D5] text-[#9A7540] hover:bg-[#FBF8F3] text-[11px] font-bold transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
