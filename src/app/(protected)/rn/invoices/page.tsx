'use client';
// src/app/(protected)/rn/invoices/page.tsx
// RIPPLE NEXUS INVOICE HISTORY
// Dedicated view for RN invoices, fully separated from Catalyst.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { IconSearch, IconAlert, IconCheck, IconTarget, IconList, IconDocument, IconPlus } from '@/components/Icons';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import type { InvoiceData } from '@/types';

// Simple toast hook local to the page (avoids shared provider dependency if we decouple further later)
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const show = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  return { toasts, show };
}

export default function RnInvoiceHistory() {
  const router = useRouter();
  const { toasts, show } = useToast();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InvoiceData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: '200' });
    if (statusFilter) p.set('status', statusFilter);
    // RN specific API endpoint
    const res = await fetch(`/api/rn/invoices?${p}`);
    const data = await res.json();
    setInvoices(data.invoices ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  const handleResend = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/invoices/${id}/resend-email`, { method: 'POST' });
    show(res.ok ? 'Email resent successfully' : 'Failed to resend email', res.ok ? 'success' : 'error');
  };

  return (
    <RippleNexusShell>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title" style={{ color: '#7C5CFF' }}>Agency Invoices</h1>
            <p className="page-subtitle">Track and manage B2B billing and retainers</p>
          </div>
          <Link href="/rn/invoices/new" className="btn btn-primary" style={{ background: '#7C5CFF', borderColor: '#7C5CFF', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <IconPlus size={16} /> New Invoice
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 14, top: 11, color: 'var(--muted)' }}><IconSearch size={16} /></div>
            <input
              type="text"
              placeholder="Search by name, email, or invoice #..."
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 38, margin: 0 }}
            />
          </div>
          <select className="input" value={statusFilter} onChange={e => setStatus(e.target.value)} style={{ width: 140, margin: 0 }}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <IconDocument size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>No invoices found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{search || statusFilter ? 'Try adjusting your filters.' : 'Create your first agency invoice.'}</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Client</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Created</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }} onClick={() => router.push(`/rn/invoices/${inv.id}`)} className="tr-hover">
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{inv.invoiceNumber}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {inv.paymentGateway}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{inv.clientName}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inv.clientEmail}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                        {inv.currency} {inv.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{inv.country}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: '.5px',
                        background: inv.status === 'PAID' ? 'var(--success-bg)' : inv.status === 'PENDING' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                        color: inv.status === 'PAID' ? 'var(--success)' : inv.status === 'PENDING' ? 'var(--warning)' : 'var(--danger)'
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>
                      {format(new Date(inv.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv); }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="card" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 400, zIndex: 100, padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#dc2626' }}>Delete Invoice?</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteTarget.invoiceNumber}</strong>?<br/>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? 'var(--danger-bg)' : '#10b981',
            color: t.type === 'error' ? 'var(--danger)' : '#fff',
            padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </RippleNexusShell>
  );
}
