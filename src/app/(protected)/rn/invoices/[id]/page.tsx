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
  const [activeTab, setActiveTab]     = useState<'details' | 'preview'>('details');

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
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {showBanner && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-xs">
            <span className="text-2xl sm:text-3xl">✅</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm sm:text-base text-emerald-900">Invoice Created Successfully!</div>
              <div className="text-xs text-emerald-700 mt-0.5">Email notification dispatched to {invoice.clientEmail} · Payment gateway active</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Link href="/rn/invoices" className="text-[#7C5CFF] hover:underline">Invoices</Link>
            <span>/</span>
            <span className="text-slate-700 font-mono font-bold">{invoice.invoiceNumber}</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <button className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5" onClick={handleResend} disabled={resending}>
              <span>{resending ? '⏳' : '📧'}</span>
              <span>{resending ? 'Sending…' : 'Resend'}</span>
            </button>
            {invoice.status === 'PENDING' && (
              (() => {
                const isPayPal = invoice.paymentGateway === 'PAYPAL';
                const payUrl   = isPayPal ? invoice.paypalPaymentUrl : invoice.razorpayLinkUrl;
                return payUrl ? (
                  <a href={payUrl} target="_blank" rel="noopener noreferrer" className="col-span-2 sm:col-span-1 px-4 py-2 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5">
                    <span>💳</span>
                    <span>{isPayPal ? 'PayPal Link ↗' : 'Payment Link ↗'}</span>
                  </a>
                ) : null;
              })()
            )}
            {invoice.status !== 'PAID' && (
              <button className="col-span-2 sm:col-span-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5" onClick={handleMarkPaid} disabled={markingPaid}>
                <span>✓</span>
                <span>{markingPaid ? 'Updating…' : 'Mark as Paid'}</span>
              </button>
            )}
            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5" onClick={handleSyncRazorpay} disabled={syncing}>
                <span>↻</span>
                <span>{syncing ? 'Syncing…' : 'Sync Gateway'}</span>
              </button>
            )}
            <button className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5" onClick={() => setShowDelete(true)}>
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/80">
            <button 
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3.5 sm:py-4 text-xs sm:text-sm font-bold transition-all border-b-2 ${
                activeTab === 'details' ? 'border-[#7C5CFF] text-[#7C5CFF] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🧾 Invoice Details
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-3.5 sm:py-4 text-xs sm:text-sm font-bold transition-all border-b-2 ${
                activeTab === 'preview' ? 'border-[#7C5CFF] text-[#7C5CFF] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📧 Email Preview
            </button>
          </div>

          {activeTab === 'details' ? (
            <>
              {/* Header */}
              <div className="bg-gradient-to-br from-[#7C5CFF] via-[#5B3CF5] to-[#22D3EE] text-white p-5 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                  <div>
                    <Logo variant="horizontal" size={36} brandId="ripple_nexus" dark />
                    <div className="text-white/80 text-xs mt-3">hello@theripplenexus.com</div>
                    <div className="text-white/80 text-xs">theripplenexus.com</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="inline-block sm:block bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 mb-1">Invoice</div>
                      <div className="font-mono text-xl sm:text-2xl font-black text-white">{invoice.invoiceNumber}</div>
                      <div className="mt-2.5"><StatusBadge status={invoice.status} /></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6">
                  <div className="bg-black/15 border border-white/15 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Issue Date</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-1">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="bg-black/15 border border-white/15 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Due Date</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-1">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="bg-black/15 border border-white/15 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Currency</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-1">{invoice.currency} ({invoice.currencySymbol})</div>
                  </div>
                </div>
              </div>

              {/* Client Details */}
              <div className="bg-slate-50/80 border-b border-slate-200 p-5 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Bill To</div>
                    <div className="text-base sm:text-lg font-extrabold text-slate-900">{invoice.clientName}</div>
                    {invoice.companyName && <div className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">{invoice.companyName}</div>}
                    <div className="text-xs sm:text-sm text-slate-500 mt-1">{invoice.clientEmail}</div>
                    {invoice.clientPhone && <div className="text-xs sm:text-sm text-slate-500">{invoice.clientPhone}</div>}
                    {invoice.country && <div className="text-xs sm:text-sm text-slate-500">{invoice.country}</div>}
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Details</div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#7C5CFF]/10 text-[#7C5CFF] border border-[#7C5CFF]/20">
                      B2B Client
                    </span>
                    <div className="text-xs text-slate-500 font-mono mt-3">
                      Exchange Rate: 1 INR = {invoice.exchangeRate.toFixed(5)} {invoice.currency}
                    </div>
                    {invoice.notes && (
                      <div className="mt-2.5 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                        📝 {invoice.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="p-5 sm:p-8">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Line Items</div>
                
                {/* Mobile list */}
                <div className="block sm:hidden space-y-3">
                  {((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]).map((item, idx) => (
                    <div key={item.id ?? idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="font-bold text-sm text-slate-900">{item.description}</div>
                      <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-200">
                        <span>Qty: <strong>{item.qty}</strong></span>
                        <span className="font-mono font-bold text-slate-800">{item.lineTotal === 0 ? 'FREE' : fmt(item.lineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-center w-20">Qty</th>
                        <th className="px-4 py-3 text-right w-36">Unit Price</th>
                        <th className="px-4 py-3 text-right w-36">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]).map((item, idx) => (
                        <tr key={item.id ?? idx} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{item.description}</td>
                          <td className="px-4 py-3.5 text-center text-slate-600 font-mono">{item.qty}</td>
                          <td className="px-4 py-3.5 text-right text-slate-600 font-mono">{item.lineTotal === 0 ? '—' : fmt(item.unitPrice)}</td>
                          <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-900">
                            {item.lineTotal === 0 ? <span className="text-emerald-600 font-black">FREE</span> : fmt(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-6 flex flex-col sm:items-end">
                  <div className="w-full sm:w-80 space-y-2 text-xs sm:text-sm bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono font-bold text-slate-800">{fmt(invoice.subtotalConverted)}</span>
                    </div>
                    {(invoice.discountRate ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Discount ({invoice.discountRate}%)</span>
                        <span className="font-mono font-bold">−{fmt(invoice.discountAmount)}</span>
                      </div>
                    )}
                    {(invoice.taxRate ?? 0) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Tax ({invoice.taxRate}%)</span>
                        <span className="font-mono font-bold">+{fmt(invoice.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                      <span>Processing Fee ({(invoice.processingFeeRate * 100).toFixed(1)}%)</span>
                      <span className="font-mono font-bold text-slate-800">{fmt(invoice.processingFeeConverted)}</span>
                    </div>
                    <div className="bg-gradient-to-r from-[#7C5CFF] to-[#22D3EE] text-white p-3.5 rounded-xl flex items-center justify-between shadow-xs">
                      <span className="text-xs font-bold">Total Payable ({invoice.currency})</span>
                      <span className="font-mono text-base sm:text-lg font-black">{fmt(invoice.totalPayable)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Payment CTA */}
              {invoice.status === 'PENDING' && (
                <div className="p-5 sm:p-8 bg-slate-50/70 border-t border-slate-200 text-center">
                  {invoice.paymentGateway !== 'PAYPAL' && invoice.razorpayLinkUrl && (
                    <div className="max-w-md mx-auto space-y-3">
                      <a href={invoice.razorpayLinkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-xl bg-[#7C5CFF] hover:bg-[#6A48F5] text-white text-sm font-extrabold shadow-md transition-all">
                        Pay {fmt(invoice.totalPayable)} Now ↗
                      </a>
                      <div className="text-[10px] text-slate-400 font-mono break-all">{invoice.razorpayLinkUrl}</div>
                    </div>
                  )}
                  {invoice.paymentGateway === 'PAYPAL' && invoice.paypalPaymentUrl && (
                    <div className="max-w-md mx-auto space-y-3">
                      <a href={invoice.paypalPaymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-xl bg-[#003087] hover:bg-[#002566] text-white text-sm font-extrabold shadow-md transition-all">
                        Pay {fmt(invoice.totalPayable)} via PayPal ↗
                      </a>
                      <div className="text-[10px] text-slate-400 font-mono break-all">{invoice.paypalPaymentUrl}</div>
                    </div>
                  )}
                </div>
              )}

              {invoice.status === 'PAID' && (
                <div className="p-5 sm:p-7 bg-emerald-50 border-t border-emerald-200 text-center space-y-1">
                  <div className="text-2xl">✅</div>
                  <div className="font-extrabold text-emerald-900 text-base">Payment Received</div>
                  {invoice.paidAt && <div className="text-xs text-emerald-700">Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy, h:mm a')}</div>}
                </div>
              )}
            </>
          ) : (
            <div className="p-0 bg-slate-100 flex justify-center min-h-[600px]">
              <div className="w-full max-w-2xl bg-white shadow-lg">
                <iframe 
                  src={`/api/invoices/${invoice.id}/preview`} 
                  className="w-full h-full min-h-[600px] border-none"
                  title="Email Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>

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
