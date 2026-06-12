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
const STATUS_META: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
  PAID:           { label: 'Paid',           cls: 'badge-paid',      dot: '#059669' },
  PARTIALLY_PAID: { label: 'Partially Paid', cls: 'badge-pending',   dot: '#2563eb' },
  PENDING:        { label: 'Pending',        cls: 'badge-pending',   dot: '#d97706' },
  EXPIRED:        { label: 'Expired',        cls: 'badge-expired',   dot: '#94a3b8' },
  CANCELLED:      { label: 'Cancelled',      cls: 'badge-cancelled', dot: '#ef4444' },
};
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`badge ${m.cls}`}>
      <span className="badge-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

// ─── Tier tag ─────────────────────────────────────────────────────
const TIER_CLS: Record<ClientType, string> = {
  FRESHER:        'tag-fresher',
  MID_CAREER:     'tag-mid-career',
  EXECUTIVE:      'tag-executive',
  EXECUTIVE_PLUS: 'tag-executive-plus',
  AGENCY_CLIENT:  'tag-agency-client',
};
function TierTag({ type }: { type: ClientType }) {
  return (
    <span className={`badge ${TIER_CLS[type]}`}>
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
      <div className="page-header" style={{ paddingBottom: 48 }}>

        {/* Page title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="text-display font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeBrand === 'ripple_nexus' ? 'Mission Control' : 'Mission Control'}
            </h1>
            <p className="text-subheading mt-2" style={{ color: 'var(--text-secondary)' }}>
              {activeBrand === 'ripple_nexus' ? 'Ripple Nexus Operations Overview' : 'Catalyst Operations Overview'}
            </p>
          </div>
          <Link href="/invoices/new" className="btn btn-primary hover-lift" style={{ padding: '12px 24px', fontSize: 14 }}>
            <span>New Invoice</span>
          </Link>
        </div>

        {/* KPI Row - Matches Active Brand Style */}
        <div className="grid-4" style={{ marginBottom: 48 }}>
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
        <div className="grid-2" style={{ marginBottom: 24, gap: 32 }}>
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

        {/* Standard Table Area */}
        <div className="text-heading font-semibold" style={{ marginBottom: 16, marginTop: 16, color: 'var(--text-primary)' }}>All Invoices</div>
        
        {/* Filters / Search bar */}
        <div className="card" style={{ padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>

          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              className="input hover-lift"
              style={{ paddingLeft: 40 }}
              placeholder="Search by client name, email, or invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className="input" style={{ width: 140, flexShrink: 0 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

            <select className="input" style={{ width: 160, flexShrink: 0 }} value={typeFilter} onChange={e => setType(e.target.value)}>
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
            <button className="btn btn-ghost btn-sm hover-lift" onClick={() => { setSearch(''); setStatus(''); setType(''); }}>✕ Clear</button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {visible.length} of {stats.total}
          </span>
        </div>

        {/* Invoice table — scrollable on mobile */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Package</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: j === 0 ? 90 : j === 1 ? 140 : 80 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '80px 0' }}>
                      <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <h3 className="text-body font-semibold text-slate-900 mb-2">No invoices found</h3>
                      <p className="text-metadata text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                        We couldn&apos;t find any invoices matching your current filters. Adjust your search or create a new invoice to get started.
                      </p>
                      <Link href="/invoices/new" className="btn btn-primary hover-lift" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600 }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14"/></svg>
                        Create Invoice
                      </Link>
                    </td>
                  </tr>
                ) : visible.map(inv => (
                  <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono" style={{ fontWeight: 700, color: inv.brandId === 'ripple_nexus' ? '#7C5CFF' : 'var(--brand)', fontSize: 13 }}>{inv.invoiceNumber}</span>
                        {inv.brandId === 'ripple_nexus' && (
                          <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', fontSize: 10 }}>nexus</span>
                        )}
                        {inv.customPricing && (
                          <span className="badge" style={{ background: '#fef9c3', color: '#78350f', fontSize: 10 }}>edited</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>{inv.clientName}</div>
                      {inv.companyName && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{inv.companyName}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{inv.clientEmail}</div>
                    </td>
                    <td><TierTag type={inv.clientType} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {formatCurrency(inv.totalPayable, inv.currencySymbol)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{inv.currency}</div>
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {format(new Date(inv.invoiceDate), 'dd MMM yyyy')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <Link href={`/invoices/${inv.id}`} className="btn btn-ghost btn-sm hover-lift">View</Link>
                        {inv.status === 'PENDING' && (
                          <button className="btn btn-ghost btn-sm" onClick={e => handleResend(inv.id, e)}>Resend</button>
                        )}
                        <button
                          className="btn btn-danger btn-icon-sm"
                          title="Delete"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(inv); }}
                          style={{ fontSize: 13 }}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteModal inv={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} busy={deleting} />
      )}
      <ToastStack toasts={toasts} />
    </AppShell>
  );
}
