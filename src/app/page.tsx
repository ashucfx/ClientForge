'use client';
// src/app/page.tsx — Enterprise Dashboard

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { InvoiceData, ClientType, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency } from '@/lib/pricing';
import { LogoSidebar } from '@/components/Logo';

// ─── Toast ────────────────────────────────────────────────────
type Toast = { id: number; msg: string; type: 'success' | 'error' };
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const show = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++counter.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, show };
}
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <span>{t.type === 'error' ? '✕' : '✓'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
    PAID:      { label: 'Paid',      cls: 'badge-paid',      dot: '#16a34a' },
    PENDING:   { label: 'Pending',   cls: 'badge-pending',   dot: '#ca8a04' },
    EXPIRED:   { label: 'Expired',   cls: 'badge-expired',   dot: '#94a3b8' },
    CANCELLED: { label: 'Cancelled', cls: 'badge-cancelled', dot: '#dc2626' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

// ─── Client type tag ──────────────────────────────────────────
function ClientTag({ type }: { type: ClientType }) {
  const map: Record<ClientType, string> = {
    FRESHER:        'bg-indigo-50 text-indigo-700',
    MID_CAREER:     'bg-pink-50 text-pink-700',
    EXECUTIVE:      'bg-amber-50 text-amber-700',
    EXECUTIVE_PLUS: 'bg-blue-50 text-blue-700',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[type]}`}>
      {CLIENT_TYPE_LABELS[type]}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, accent,
}: { label: string; value: string | number; sub?: string; icon: string; accent?: boolean }) {
  return (
    <div className={`card card-hover p-5 ${accent ? 'ring-2 ring-blue-200' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: accent ? '#e8f0fe' : '#f8faff' }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-extrabold" style={{ color: accent ? 'var(--blue)' : 'var(--text)' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────
function DeleteModal({
  invoice, onCancel, onConfirm, loading,
}: { invoice: InvoiceData; onCancel: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl mx-auto mb-4">🗑️</div>
          <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text)' }}>Delete Invoice?</h2>
          <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">
            This will permanently delete <strong className="text-slate-700">{invoice.invoiceNumber}</strong> for{' '}
            <strong className="text-slate-700">{invoice.clientName}</strong>.
            {invoice.razorpayLinkId && invoice.status === 'PENDING' && (
              <span> The Razorpay payment link will also be <strong className="text-red-600">cancelled</strong>.</span>
            )}
          </p>
          <div className="flex gap-3 mt-6">
            <button className="btn btn-ghost flex-1" onClick={onCancel} disabled={loading}>Cancel</button>
            <button className="btn btn-danger-solid flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Nav link ────────────────────────────────────────────────
function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        color:      active ? '#fff' : 'rgba(255,255,255,0.6)',
        background: active ? 'rgba(31,86,212,0.35)' : 'transparent',
      }}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { toasts, show } = useToast();

  const [invoices, setInvoices]       = useState<InvoiceData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [typeFilter, setType]         = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceData | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [stats, setStats]             = useState({ total: 0, pending: 0, paid: 0, cancelled: 0 });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: '100' });
    if (statusFilter) p.set('status', statusFilter);
    if (typeFilter)   p.set('clientType', typeFilter);
    const res  = await fetch(`/api/invoices?${p}`);
    const data = await res.json();
    const all: InvoiceData[] = data.invoices ?? [];
    setInvoices(all);
    setStats({
      total:     data.pagination?.total ?? all.length,
      pending:   all.filter(i => i.status === 'PENDING').length,
      paid:      all.filter(i => i.status === 'PAID').length,
      cancelled: all.filter(i => i.status === 'CANCELLED' || i.status === 'EXPIRED').length,
    });
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

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
      show(`Invoice ${deleteTarget.invoiceNumber} deleted`);
      setDeleteTarget(null);
      fetchInvoices();
    } else {
      show('Delete failed', 'error');
    }
    setDeleting(false);
  };

  // Client-side search
  const visible = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.clientEmail.toLowerCase().includes(q)
    );
  });

  const conversionRate = stats.total ? Math.round((stats.paid / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="px-5 py-5 border-b border-white/10">
          <LogoSidebar size={34} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/"              icon="⬛" label="Dashboard"   active />
          <NavLink href="/invoices/new"  icon="＋" label="New Invoice" />
          <NavLink href="/invoices"      icon="📄" label="All Invoices" />
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>v2.0.0 · Internal</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main-content animate-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Career Booster Invoice Management</p>
          </div>
          <Link href="/invoices/new" className="btn btn-primary">
            <span className="text-lg leading-none">+</span> New Invoice
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard label="Total Invoices" value={stats.total}  icon="📋" accent />
          <KpiCard label="Pending"        value={stats.pending} sub="Awaiting payment" icon="⏳" />
          <KpiCard label="Paid"           value={stats.paid}    sub="Completed"        icon="✅" />
          <KpiCard label="Conversion"     value={`${conversionRate}%`} sub={`${stats.paid} of ${stats.total} paid`} icon="📈" />
        </div>

        {/* Filters + Search */}
        <div className="card p-4 mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              className="input pl-9"
              placeholder="Search name, email, invoice #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="input"
            style={{ width: 140 }}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={e => setType(e.target.value)}
            className="input"
            style={{ width: 175 }}
          >
            <option value="">All Package Types</option>
            <option value="FRESHER">Fresher</option>
            <option value="MID_CAREER">Mid-Career</option>
            <option value="EXECUTIVE">Executive</option>
            <option value="EXECUTIVE_PLUS">Executive Plus</option>
          </select>
          {(statusFilter || typeFilter || search) && (
            <button
              onClick={() => { setStatus(''); setType(''); setSearch(''); }}
              className="btn btn-ghost"
              style={{ padding: '10px 14px' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Invoice Table */}
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                {['Invoice #', 'Client', 'Package', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '64px 0', color: 'var(--muted)' }}>
                  Loading…
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '64px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                  <div style={{ color: 'var(--muted)', fontWeight: 500 }}>No invoices found</div>
                  <Link href="/invoices/new" style={{ color: 'var(--blue)', fontSize: 13, marginTop: 6, display: 'inline-block' }}>
                    Create your first invoice →
                  </Link>
                </td></tr>
              ) : visible.map(inv => (
                <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)}>
                  <td>
                    <span className="mono text-sm font-bold" style={{ color: 'var(--blue)' }}>{inv.invoiceNumber}</span>
                    {inv.customPricing && (
                      <span style={{ fontSize: 10, background: '#fef9c3', color: '#92400e', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>
                        edited
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="font-semibold" style={{ color: 'var(--text)', fontSize: 14 }}>{inv.clientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inv.clientEmail}</div>
                  </td>
                  <td><ClientTag type={inv.clientType} /></td>
                  <td>
                    <div className="font-bold" style={{ color: 'var(--text)' }}>{formatCurrency(inv.totalPayable, inv.currencySymbol)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{inv.currency}</div>
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td style={{ color: 'var(--muted)' }}>{format(new Date(inv.invoiceDate), 'dd MMM yyyy')}</td>
                  <td>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Link href={`/invoices/${inv.id}`} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                        View
                      </Link>
                      {inv.status === 'PENDING' && (
                        <button
                          onClick={e => handleResend(inv.id, e)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          Resend
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(inv); }}
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        title="Delete invoice"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, textAlign: 'right' }}>
            Showing {visible.length} of {stats.total} invoices
          </div>
        )}
      </main>

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          invoice={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
