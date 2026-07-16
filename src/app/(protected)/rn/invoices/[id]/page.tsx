'use client';
// src/app/(protected)/rn/invoices/[id]/page.tsx
// RIPPLE NEXUS INVOICE DETAIL
// Completely separated from Catalyst.

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, InvoiceStatus } from '@/types';
import { formatCurrency, round2 } from '@/lib/pricing';
import { Logo } from '@/components/Logo';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';

// Toast hook
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
    PAID:           { label: 'Paid',           bg: 'var(--success-bg)', color: 'var(--success)' },
    PARTIALLY_PAID: { label: 'Partially Paid', bg: '#dbeafe', color: '#1e3a8a' },
    PENDING:        { label: 'Pending',        bg: 'var(--warning-bg)', color: 'var(--warning)' },
    EXPIRED:        { label: 'Expired',        bg: '#f1f5f9', color: '#475569' },
    CANCELLED:      { label: 'Cancelled',      bg: 'var(--danger-bg)', color: 'var(--danger)' },
  };
  const s = map[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function RnInvoiceDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { toasts, show } = useToast();

  const isJustCreated = searchParams.get('created') === 'true';

  const [invoice, setInvoice]     = useState<InvoiceData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [resending, setResending] = useState(false);
  const [showBanner, setBanner]   = useState(isJustCreated);

  const [showDelete, setShowDelete]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [syncing, setSyncing]         = useState(false);

  const loadInvoice = useCallback(() => {
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(d => { setInvoice(d.invoice); setLoading(false); });
  }, [params.id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);
  useEffect(() => {
    if (showBanner) { const t = setTimeout(() => setBanner(false), 5000); return () => clearTimeout(t); }
  }, [showBanner]);

  const handleResend = async () => {
    setResending(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/resend-email`, { method: 'POST' });
    show(res.ok ? `Email resent to ${invoice!.clientEmail}` : 'Failed to resend email', res.ok ? 'success' : 'error');
    setResending(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/invoices/${invoice!.id}`, { method: 'DELETE' });
    if (res.ok) {
      show('Invoice deleted');
      router.push('/rn/invoices');
    } else {
      show('Delete failed', 'error');
      setDeleting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!confirm(`Mark invoice ${invoice!.invoiceNumber} as PAID manually?\n\nThis will update the status and send a payment confirmation email.`)) return;
    setMarkingPaid(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid' }),
    });
    const data = await res.json();
    if (res.ok) {
      setInvoice(data.invoice);
      show('Invoice marked as paid — confirmation email sent');
    } else {
      show(data.error ?? 'Failed to mark as paid', 'error');
    }
    setMarkingPaid(false);
  };

  const handleSyncRazorpay = async () => {
    setSyncing(true);
    const res = await fetch(`/api/invoices/${invoice!.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.synced) {
        setInvoice(data.invoice);
        show(`Synced — status updated to ${data.newStatus}`);
      } else {
        show(data.message ?? 'Already up to date');
      }
    } else {
      show(data.error ?? 'Sync failed', 'error');
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <RippleNexusShell>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading invoice…</div>
      </RippleNexusShell>
    );
  }

  if (!invoice) {
    return (
      <RippleNexusShell>
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <div>Invoice not found</div>
          <Link href="/rn/invoices" style={{ color: '#7C5CFF', fontSize: 13, marginTop: 8, display: 'inline-block' }}>← Back to Invoices</Link>
        </div>
      </RippleNexusShell>
    );
  }

  const fmt = (n: number) => formatCurrency(n, invoice.currencySymbol);

  return (
    <RippleNexusShell>
      <main className="page-wrapper" style={{ maxWidth: 1000, margin: '0 auto' }}>
        {showBanner && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid #86efac', color: 'var(--success)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700 }}>Invoice Created Successfully!</div>
              <div style={{ fontSize: 13, opacity: .8 }}>Email sent to {invoice.clientEmail} · Payment link ready</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Link href="/rn/invoices" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Invoices</Link>
            <span>/</span>
            <span style={{ color: '#7C5CFF', fontWeight: 700 }}>{invoice.invoiceNumber}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={handleResend} disabled={resending}>
              {resending ? '⏳ Sending…' : '📧 Resend Email'}
            </button>
            {invoice.status === 'PENDING' && (
              (() => {
                const isPayPal = invoice.paymentGateway === 'PAYPAL';
                const payUrl   = isPayPal ? invoice.paypalPaymentUrl : invoice.razorpayLinkUrl;
                return payUrl ? (
                  <a href={payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 13, padding: '8px 14px', background: '#7C5CFF', borderColor: '#7C5CFF' }}>
                    {isPayPal ? 'PayPal Link ↗' : 'Payment Link ↗'}
                  </a>
                ) : null;
              })()
            )}
            {invoice.status !== 'PAID' && (
              <button className="btn" style={{ fontSize: 13, padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none' }} onClick={handleMarkPaid} disabled={markingPaid}>
                {markingPaid ? 'Updating…' : 'Mark as Paid'}
              </button>
            )}
            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={handleSyncRazorpay} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync Razorpay'}
              </button>
            )}
            <button className="btn" style={{ fontSize: 13, padding: '8px 14px', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => setShowDelete(true)}>
              🗑️ Delete
            </button>
          </div>
        </div>

        <div className="card overflow-hidden" style={{ boxShadow: '0 4px 40px rgba(124,92,255,.08)' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', padding: '32px 36px' }}>
            <div className="flex items-start justify-between">
              <div>
                <Logo variant="horizontal" size={38} brandId="ripple_nexus" dark />
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 16 }}>hello@theripplenexus.com</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>theripplenexus.com</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 18px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>Invoice</div>
                  <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginTop: 2 }}>{invoice.invoiceNumber}</div>
                  <div style={{ marginTop: 8 }}><StatusBadge status={invoice.status} /></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                ['Issue Date', format(new Date(invoice.invoiceDate), 'dd MMM yyyy')],
                ['Due Date',   format(new Date(invoice.dueDate),     'dd MMM yyyy')],
                ['Currency',   `${invoice.currency} (${invoice.currencySymbol})`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginTop: 3 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Details */}
          <div style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', padding: '20px 36px' }}>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Bill To</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{invoice.clientName}</div>
                {invoice.companyName && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{invoice.companyName}</div>}
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{invoice.clientEmail}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.clientPhone}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.country}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Details</div>
                <span style={{ background: 'var(--brand-light)', color: '#7C5CFF', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>B2B Client</span>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                  Exchange Rate: 1 INR = {invoice.exchangeRate.toFixed(5)} {invoice.currency}
                </div>
                {invoice.notes && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                    📝 {invoice.notes}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ padding: '24px 36px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>Line Items</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-3)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8 }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8, width: 60 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8, width: 120 }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8, width: 120 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]).map((item, idx) => (
                  <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '13px 12px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.description}</td>
                    <td style={{ padding: '13px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{item.qty}</td>
                    <td style={{ padding: '13px 12px', textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>{item.lineTotal === 0 ? '—' : fmt(item.unitPrice)}</td>
                    <td style={{ padding: '13px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                      {item.lineTotal === 0 ? <span style={{ color: '#10b981' }}>FREE</span> : fmt(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals breakdown */}
            <div style={{ maxWidth: 320, marginLeft: 'auto', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', paddingBottom: 8, borderBottom: '1px dashed var(--border)' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{fmt(invoice.subtotalConverted)}</span>
              </div>
              {(invoice.discountRate ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
                  <span>Discount ({invoice.discountRate}%)</span>
                  <span style={{ fontWeight: 600 }}>−{fmt(invoice.discountAmount)}</span>
                </div>
              )}
              {(invoice.taxRate ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                  <span>Tax ({invoice.taxRate}%)</span>
                  <span style={{ fontWeight: 600 }}>+{fmt(invoice.taxAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                <span>Processing Fee ({(invoice.processingFeeRate * 100).toFixed(1)}%)</span>
                <span style={{ fontWeight: 600 }}>{fmt(invoice.processingFeeConverted)}</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 13 }}>Total Payable ({invoice.currency})</span>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{fmt(invoice.totalPayable)}</span>
              </div>
            </div>
          </div>

          {/* Payment CTA */}
          {invoice.status === 'PENDING' && (
            <>
              {invoice.paymentGateway !== 'PAYPAL' && invoice.razorpayLinkUrl && (
                <div style={{ background: 'var(--surface-3)', borderTop: '1px solid var(--border)', padding: '24px 36px', textAlign: 'center' }}>
                  <a href={invoice.razorpayLinkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 36px', background: '#7C5CFF', borderColor: '#7C5CFF' }}>
                    Pay {fmt(invoice.totalPayable)} Now
                  </a>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>{invoice.razorpayLinkUrl}</div>
                </div>
              )}
              {invoice.paymentGateway === 'PAYPAL' && invoice.paypalPaymentUrl && (
                <div style={{ background: 'var(--surface-3)', borderTop: '1px solid var(--border)', padding: '24px 36px', textAlign: 'center' }}>
                  <a href={invoice.paypalPaymentUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#003087', color: '#fff', textDecoration: 'none', padding: '14px 36px', borderRadius: 8, fontWeight: 800, fontSize: 16 }}>
                    Pay {fmt(invoice.totalPayable)} via PayPal
                  </a>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>{invoice.paypalPaymentUrl}</div>
                </div>
              )}
            </>
          )}

          {invoice.status === 'PAID' && (
            <div style={{ background: 'var(--success-bg)', borderTop: '1px solid #86efac', padding: '20px 36px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 16 }}>Payment Received</div>
              {invoice.paidAt && <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 4 }}>Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy, h:mm a')}</div>}
            </div>
          )}
        </div>
      </main>

      {/* Delete Modal */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => !deleting && setShowDelete(false)}>
          <div className="card" style={{ width: '90%', maxWidth: 400, margin: '0 auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#dc2626' }}>Delete Invoice?</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text)' }}>Are you sure you want to delete <strong>{invoice.invoiceNumber}</strong>?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.type === 'error' ? 'var(--danger-bg)' : '#10b981', color: t.type === 'error' ? 'var(--danger)' : '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{t.msg}</div>
        ))}
      </div>
    </RippleNexusShell>
  );
}
