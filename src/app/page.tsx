'use client';
// src/app/page.tsx

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, ClientType, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency } from '@/lib/pricing';

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map = {
    PAID: { label: 'Paid', dot: '#3FBD8B', bg: '#e6f9f1', text: '#1a6b4a' },
    PENDING: { label: 'Pending', dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
    EXPIRED: { label: 'Expired', dot: '#9ca3af', bg: '#f3f4f6', text: '#374151' },
    CANCELLED: { label: 'Cancelled', dot: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span style={{ background: s.bg, color: s.text }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
      <span style={{ background: s.dot }} className="w-1.5 h-1.5 rounded-full" />
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ borderColor: '#e8eeff' }} className={`bg-white rounded-2xl border p-5 card-hover ${accent ? 'ring-1 ring-[#1f56d4]/20' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
      <div style={{ color: accent ? '#1f56d4' : '#0f1c3d' }} className="text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CLIENT TYPE TAG
// ─────────────────────────────────────────────
function ClientTypeTag({ type }: { type: ClientType }) {
  const colors: Record<ClientType, string> = {
    FRESHER: '#e0e7ff,#3730a3',
    MID_CAREER: '#fce7f3,#9d174d',
    EXECUTIVE: '#fef3c7,#92400e',
    EXECUTIVE_PLUS: '#e8f0fe,#1f56d4',
  };
  const [bg, text] = colors[type]?.split(',') ?? ['#f3f4f6', '#374151'];
  return (
    <span style={{ background: bg, color: text }} className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold">
      {CLIENT_TYPE_LABELS[type]}
    </span>
  );
}

// ─────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────
export default function Dashboard() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0 });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('clientType', typeFilter);
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices ?? []);
    
    // Compute stats
    const all = data.invoices ?? [];
    setStats({
      total: data.pagination?.total ?? all.length,
      pending: all.filter((i: InvoiceData) => i.status === 'PENDING').length,
      paid: all.filter((i: InvoiceData) => i.status === 'PAID').length,
    });
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleResendEmail = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/invoices/${id}/resend-email`, { method: 'POST' });
    if (res.ok) alert('Email resent successfully');
    else alert('Failed to resend email');
  };

  return (
    <div className="min-h-screen" style={{ background: '#f0f4ff' }}>
      {/* SIDEBAR */}
      <div className="flex">
        <aside style={{ background: '#0f1c3d', minHeight: '100vh' }} className="w-60 flex-shrink-0 flex flex-col fixed left-0 top-0 bottom-0 z-10">
          <div className="px-6 py-6 border-b border-white/10">
            <div className="text-2xl font-extrabold text-white tracking-tight">
              Ripple<span style={{ color: '#3FBD8B' }}>Nexus</span>
            </div>
            <div className="text-xs text-white/40 mt-0.5">Invoice System</div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'rgba(31,86,212,0.3)' }}>
              <span>📊</span> Dashboard
            </a>
            <Link href="/invoices/new" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <span>➕</span> New Invoice
            </Link>
            <Link href="/invoices" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <span>📄</span> All Invoices
            </Link>
          </nav>
          <div className="px-5 py-4 border-t border-white/10">
            <div className="text-xs text-white/30">v1.0.0 · Internal Tool</div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="ml-60 flex-1 p-8 animate-page">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: '#0f1c3d' }}>Dashboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">Career Booster Invoice Management</p>
            </div>
            <Link
              href="/invoices/new"
              style={{ background: '#1f56d4' }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"
            >
              <span>+</span> New Invoice
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Invoices" value={stats.total} accent />
            <StatCard label="Pending" value={stats.pending} sub="Awaiting payment" />
            <StatCard label="Paid" value={stats.paid} sub="Completed" />
            <StatCard label="Conversion" value={stats.total ? `${Math.round((stats.paid / stats.total) * 100)}%` : '0%'} sub="Payment rate" />
          </div>

          {/* Filters */}
          <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-4 mb-4 flex gap-3 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            >
              <option value="">All Types</option>
              <option value="FRESHER">Fresher</option>
              <option value="MID_CAREER">Mid-Career</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="EXECUTIVE_PLUS">Executive Plus</option>
            </select>
            {(statusFilter || typeFilter) && (
              <button onClick={() => { setStatusFilter(''); setTypeFilter(''); }} className="text-xs text-blue-600 hover:underline">
                Clear
              </button>
            )}
          </div>

          {/* Invoice Table */}
          <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f8faff', borderBottom: '1px solid #e8eeff' }}>
                  {['Invoice #', 'Client', 'Type', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">Loading invoices...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="text-4xl mb-3">📄</div>
                      <div className="text-gray-400 font-medium">No invoices found</div>
                      <Link href="/invoices/new" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Create your first invoice →</Link>
                    </td>
                  </tr>
                ) : invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: i < invoices.length - 1 ? '1px solid #f0f4ff' : 'none' }}
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/invoices/${inv.id}`}
                  >
                    <td className="px-5 py-4">
                      <span className="mono text-sm font-semibold" style={{ color: '#1f56d4' }}>{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm" style={{ color: '#0f1c3d' }}>{inv.clientName}</div>
                      <div className="text-xs text-gray-400">{inv.clientEmail}</div>
                    </td>
                    <td className="px-5 py-4"><ClientTypeTag type={inv.clientType} /></td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-sm" style={{ color: '#0f1c3d' }}>
                        {formatCurrency(inv.totalPayable, inv.currencySymbol)}
                      </div>
                      <div className="text-xs text-gray-400">{inv.currency}</div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-gray-600">{format(new Date(inv.invoiceDate), 'dd MMM yyyy')}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                          style={{ background: '#e8f0fe', color: '#1f56d4' }}
                        >
                          View
                        </Link>
                        <button
                          onClick={(e) => handleResendEmail(inv.id, e)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                          style={{ background: '#f0f4ff', color: '#4a5568' }}
                        >
                          Resend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
