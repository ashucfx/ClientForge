'use client';
// src/app/page.tsx — Enterprise Dashboard

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { InvoiceData, ClientType, InvoiceStatus } from '@/types';
import { formatCurrency, CLIENT_TYPE_LABELS } from '@/lib/pricing';
import { IconCheck, IconDocument, IconPending, IconSearch, IconTrendUp } from '@/components/Icons';
import AppShell from '@/components/AppShell';
import { isRnModuleEnabledClient } from '@/lib/brand/flags';
import { useBrand } from '@/components/BrandProvider';
import type { BrandId } from '@/lib/brand/types';
import { useAdmin } from '@/components/AdminProvider';

// ─── Toast ───────────────────────────────────────────────────────
type ToastItem = { id: number; msg: string; type: 'success' | 'error' | 'warn' };
function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const ref = useRef(0);
  const show = useCallback((msg: string, type: ToastItem['type'] = 'success') => {
    const id = ++ref.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  return { toasts, show };
}
function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (!toasts.length) return null;
  const icon = { success: '✓', error: '✕', warn: '!' };
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{icon[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────
const STATUS_META: Record<InvoiceStatus, { label: string; bg: string; text: string; dot: string }> = {
  PAID:           { label: 'Paid',           bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500'  },
  PARTIALLY_PAID: { label: 'Partial',        bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'     },
  PENDING:        { label: 'Pending',        bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'    },
  EXPIRED:        { label: 'Expired',        bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400'    },
  CANCELLED:      { label: 'Cancelled',      bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400'      },
};
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Tier tag ─────────────────────────────────────────────────────
const TIER_COLORS: Record<ClientType, string> = {
  FRESHER:        'bg-slate-100 text-slate-600',
  MID_CAREER:     'bg-[#FBF8F3] text-[#9A7540] border border-[#E8DDD0]',
  EXECUTIVE:      'bg-purple-50 text-purple-700 border border-purple-100',
  EXECUTIVE_PLUS: 'bg-purple-100 text-purple-800 border border-purple-200',
  AGENCY_CLIENT:  'bg-violet-100 text-violet-700 border border-violet-200',
};
function TierTag({ type }: { type: ClientType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TIER_COLORS[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {CLIENT_TYPE_LABELS[type]}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, bg, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; bg: string; accent?: boolean;
}) {
  return (
    <div className="kpi-card" style={accent ? { borderColor: '#bfdbfe', boxShadow: '0 0 0 1px #bfdbfe, 0 4px 12px rgba(31,86,212,.08)' } : {}}>
      <div className="kpi-icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: 'var(--brand)' } : {}}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────
function DeleteModal({ inv, onCancel, onConfirm, busy }: {
  inv: InvoiceData; onCancel(): void; onConfirm(): void; busy: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Delete Invoice?</div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onCancel} style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Permanently delete <strong style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</strong> for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{inv.clientName}</strong>?
            {inv.razorpayLinkId && inv.status === 'PENDING' && (
              <> The active Razorpay payment link will be <span style={{ color: 'var(--error)', fontWeight: 600 }}>cancelled</span>.</>
            )}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger-solid" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mini revenue chart (SVG bar) ─────────────────────────────────
function RevenueBar({ invoices }: { invoices: InvoiceData[] }) {
  const paid = invoices.filter(i => i.status === 'PAID');
  if (!paid.length) return null;

  // Group by currency
  const byCurrency: Record<string, number> = {};
  paid.forEach(inv => {
    byCurrency[inv.currency] = (byCurrency[inv.currency] ?? 0) + inv.totalPayable;
  });

  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14 }}>
        Revenue Collected
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(byCurrency).map(([cur, total]) => {
          const sym = paid.find(i => i.currency === cur)?.currencySymbol ?? cur;
          return (
            <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ minWidth: 40, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{cur}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99 }}>
                <div style={{ height: '100%', background: 'var(--brand)', borderRadius: 99, width: '100%' }} />
              </div>
              <span style={{ minWidth: 80, textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                {formatCurrency(total, sym)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();
  const { toasts, show } = useToast();
  const { activeBrand } = useBrand();
  const [invoices, setInvoices]         = useState<InvoiceData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatus]       = useState('');
  const [typeFilter, setType]           = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceData | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const stats = {
    total:      invoices.length,
    pending:    invoices.filter(i => i.status === 'PENDING').length,
    paid:       invoices.filter(i => i.status === 'PAID').length,
    cancelled:  invoices.filter(i => i.status === 'CANCELLED' || i.status === 'EXPIRED').length,
    conversion: invoices.length ? Math.round((invoices.filter(i => i.status === 'PAID').length / invoices.length) * 100) : 0,
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: '200' });
    if (statusFilter) p.set('status', statusFilter);
    if (typeFilter)   p.set('clientType', typeFilter);

    // Phase 5C: Use tenant-namespaced API endpoints — no brandId param needed
    // brandId is enforced server-side via JWT activeTenant claim
    let apiUrl: string;
    if (activeBrand === 'ripple_nexus') {
      apiUrl = `/api/rn/invoices?${p}`;
    } else if (activeBrand === 'catalyst') {
      apiUrl = `/api/catalyst/invoices?${p}`;
    } else {
      // 'all' — SUPER_ADMIN cross-brand view: use legacy shared endpoint
      apiUrl = `/api/invoices?${p}`;
    }

    const res  = await fetch(apiUrl);
    const data = await res.json();
    setInvoices(data.invoices ?? []);
    setLoading(false);
  }, [statusFilter, typeFilter, activeBrand]);

  useEffect(() => { 
    fetchInvoices(); 
  }, [fetchInvoices]);


  // Client-side search
  const visible = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.clientEmail.toLowerCase().includes(q) ||
      (inv.companyName ?? '').toLowerCase().includes(q)
    );
  });

  const handleResend = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/invoices/${id}/resend-email`, { method: 'POST' });
    show(res.ok ? 'Email resent successfully' : 'Failed to resend email', res.ok ? 'success' : 'error');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      show(`${deleteTarget.invoiceNumber} deleted`);
      setDeleteTarget(null);
      fetchInvoices();
    } else {
      show('Delete failed', 'error');
    }
    setDeleting(false);
  };

  return (
    <AppShell>
      <div className="page-header pb-6 sm:pb-10">

        {/* Page title row */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6 sm:mb-10">
          <div>
            <h1 className="text-display font-semibold" style={{ color: 'var(--text-primary)' }}>Mission Control</h1>
            <p className="text-subheading mt-1 sm:mt-2" style={{ color: 'var(--text-secondary)' }}>
              {activeBrand === 'ripple_nexus' ? 'Ripple Nexus Operations Overview' : 'Catalyst Operations Overview'}
            </p>
          </div>
          <Link href="/invoices/new" className="btn btn-primary hover-lift" style={{ padding: '10px 20px', fontSize: 14 }}>
            <span>New Invoice</span>
          </Link>
        </div>

        {/* KPI Row - Matches Active Brand Style */}
        <div className="grid-4 mb-6 sm:mb-10">
          {activeBrand === 'ripple_nexus' ? (
            <>
              <KpiCard label="Total Invoices" value={stats.total} icon={<IconDocument style={{ color: '#7C5CFF' }} />} bg="#f3f0ff" accent />
              <KpiCard label="Pending Payment" value={stats.pending} icon={<IconPending style={{ color: '#7C5CFF' }} />} bg="#e0e7ff" sub="Action Required" />
              <KpiCard label="Completed" value={stats.paid} icon={<IconCheck style={{ color: '#7C5CFF' }} />} bg="#ede9fe" sub="Paid in full" />
              <KpiCard label="Collection Rate" value={`${stats.conversion}%`} icon={<IconTrendUp style={{ color: '#7C5CFF' }} />} bg="#f5f3ff" sub={`${stats.paid} of ${stats.total} paid`} />
            </>
          ) : (
            <>
              <KpiCard label="Total Invoices" value={stats.total} icon={<IconDocument style={{ color: 'var(--brand)' }} />} bg="#eff6ff" accent />
              <KpiCard label="Pending Payment" value={stats.pending} icon={<IconPending style={{ color: 'var(--brand)' }} />} bg="#e0f2fe" sub="Action Required" />
              <KpiCard label="Completed" value={stats.paid} icon={<IconCheck style={{ color: '#3FBD8B' }} />} bg="#d1fae5" sub="Paid in full" />
              <KpiCard label="Collection Rate" value={`${stats.conversion}%`} icon={<IconTrendUp style={{ color: 'var(--brand)' }} />} bg="#eef2ff" sub={`${stats.paid} of ${stats.total} paid`} />
            </>
          )}
        </div>

        {/* Action Center & Revenue */}
        <div className="grid-2 mb-4" style={{ gap: 24 }}>
          {/* Action Center */}
          <div className="card hover-lift" style={{ padding: '24px 32px' }}>
            <div className="text-heading font-semibold" style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
              Action Required
            </div>
            {stats.pending > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-body font-semibold">{stats.pending} Invoices Awaiting Payment</div>
                  <div className="text-metadata text-secondary mt-1">Review outstanding invoices and send reminders.</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setStatus('PENDING')}>Review</button>
              </div>
            ) : (
              <div style={{ padding: '24px 0', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>🎉</span>
                All caught up! No pending actions.
              </div>
            )}
          </div>
          
          {/* Revenue bar */}
          {!loading && <RevenueBar invoices={invoices} />}
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>

        {/* All Invoices header */}
        <div className="flex items-center justify-between mt-4 mb-4">
          <h2 className="text-base font-bold text-slate-800">All Invoices</h2>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex items-center gap-3 flex-wrap shadow-sm">
          <div className="relative flex-1" style={{ minWidth: 200 }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#B8935B] transition-colors placeholder:text-slate-300"
              placeholder="Search client, email, invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#B8935B] transition-colors text-slate-600 bg-white"
            style={{ minWidth: 130 }}
            value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#B8935B] transition-colors text-slate-600 bg-white"
            style={{ minWidth: 150 }}
            value={typeFilter} onChange={e => setType(e.target.value)}>
            <option value="">All Packages</option>
            {activeBrand === 'ripple_nexus' ? (
              <option value="AGENCY_CLIENT">Agency Client</option>
            ) : (
              <>
                <option value="FRESHER">Fresher</option>
                <option value="MID_CAREER">Mid-Career</option>
                <option value="EXECUTIVE">Executive</option>
                <option value="EXECUTIVE_PLUS">Executive Plus</option>
              </>
            )}
          </select>
          {(search || statusFilter || typeFilter) && (
            <button onClick={() => { setSearch(''); setStatus(''); setType(''); }}
              className="px-3 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 font-medium whitespace-nowrap">
            {visible.length} of {stats.total}
          </span>
        </div>

        {/* ── Mobile invoice cards (< md) ──────────────────────────── */}
        {loading ? (
          <div className="md:hidden space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
                <div className="flex justify-between mb-2">
                  <div className="h-3.5 w-28 bg-slate-100 rounded-full" />
                  <div className="h-5 w-16 bg-slate-100 rounded-full" />
                </div>
                <div className="h-4 w-40 bg-slate-100 rounded-full mb-1" />
                <div className="h-3 w-32 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="md:hidden py-16 text-center">
            <p className="text-sm font-semibold text-slate-700 mb-1">No invoices found</p>
            <p className="text-xs text-slate-400 mb-4">Adjust filters or create a new invoice</p>
            <Link href="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8935B] text-white text-sm font-semibold rounded-xl">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 5v14m-7-7h14"/></svg>
              New Invoice
            </Link>
          </div>
        ) : (
          <div className="md:hidden space-y-2">
            {visible.map(inv => {
              const payLink = inv.paymentGateway === 'PAYPAL' ? inv.paypalPaymentUrl : inv.razorpayLinkUrl;
              const isPending = inv.status === 'PENDING';
              return (
                <div key={inv.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <Link href={`/invoices/${inv.id}`} className="block p-4 hover:bg-[#FBF8F3]/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[12px] text-[#B8935B]">{inv.invoiceNumber}</span>
                          {inv.paymentGateway === 'PAYPAL'
                            ? <span className="text-[9px] font-bold text-blue-500">PayPal</span>
                            : <span className="text-[9px] font-bold text-orange-500">Razorpay</span>}
                          {inv.customPricing && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">edited</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{format(new Date(inv.invoiceDate), 'dd MMM yyyy')}</div>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{inv.clientName}</div>
                        <div className="text-[11px] text-slate-400 truncate">{inv.clientEmail}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-slate-900 text-sm">{formatCurrency(inv.totalPayable, inv.currencySymbol)}</div>
                        <div className="mt-0.5"><TierTag type={inv.clientType} /></div>
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Link href={`/invoices/${inv.id}`}
                      className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      View
                    </Link>
                    {isPending && (
                      <button onClick={e => handleResend(inv.id, e)} title="Resend email"
                        className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-[#B8935B] transition-colors">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </button>
                    )}
                    {isPending && payLink && (
                      <button onClick={() => { void navigator.clipboard.writeText(payLink); show('Payment link copied!'); }} title="Copy payment link"
                        className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(inv); }} title="Delete"
                      className="ml-auto p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Desktop invoice table (≥ md) ─────────────────────────── */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3.5 rounded-full bg-slate-100 animate-pulse" style={{ width: j === 0 ? 100 : j === 1 ? 140 : 70 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">No invoices found</p>
                    <p className="text-xs text-slate-400 mb-5">Try adjusting your filters or create a new invoice</p>
                    <Link href="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8935B] text-white text-sm font-semibold rounded-xl hover:bg-[#9A7540] transition-colors">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 5v14m-7-7h14"/></svg>
                      New Invoice
                    </Link>
                  </td>
                </tr>
              ) : visible.map(inv => {
                const payLink = inv.paymentGateway === 'PAYPAL' ? inv.paypalPaymentUrl : inv.razorpayLinkUrl;
                const isPending = inv.status === 'PENDING';
                return (
                  <tr key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="border-b border-slate-100 last:border-0 hover:bg-[#FBF8F3]/40 cursor-pointer transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[12px] text-[#B8935B]">{inv.invoiceNumber}</span>
                        {inv.brandId === 'ripple_nexus' && (
                          <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold">nexus</span>
                        )}
                        {inv.customPricing && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">edited</span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        {inv.paymentGateway === 'PAYPAL' ? (
                          <span className="text-[9px] font-semibold text-blue-500">PayPal</span>
                        ) : (
                          <span className="text-[9px] font-semibold text-orange-500">Razorpay</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 text-sm">{inv.clientName}</div>
                      {inv.companyName && <div className="text-[11px] text-slate-400">{inv.companyName}</div>}
                      <div className="text-[11px] text-slate-400">{inv.clientEmail}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <TierTag type={inv.clientType} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold text-slate-900 text-sm">{formatCurrency(inv.totalPayable, inv.currencySymbol)}</div>
                      <div className="text-[10px] text-slate-400">{inv.currency}</div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(inv.invoiceDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <Link href={`/invoices/${inv.id}`}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          View
                        </Link>
                        {isPending && (
                          <button onClick={e => handleResend(inv.id, e)}
                            title="Resend payment email"
                            className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-[#B8935B] transition-colors">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                          </button>
                        )}
                        {isPending && payLink && (
                          <button
                            onClick={() => { void navigator.clipboard.writeText(payLink); show('Payment link copied!'); }}
                            title={`Copy ${inv.paymentGateway === 'PAYPAL' ? 'PayPal' : 'Razorpay'} payment link`}
                            className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                          </button>
                        )}
                        <button
                          title="Delete invoice"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(inv); }}
                          className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <DeleteModal inv={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} busy={deleting} />
      )}
      <ToastStack toasts={toasts} />
    </AppShell>
  );
}
