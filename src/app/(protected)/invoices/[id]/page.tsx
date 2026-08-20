'use client';
// src/app/invoices/[id]/page.tsx — Invoice Detail with Edit Pricing + Delete

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency, BASE_PRICING, REVISION_FEE, round2 } from '@/lib/pricing';
import { Logo } from '@/components/Logo';
import AppShell from '@/components/AppShell';

// ─── Toast ────────────────────────────────────
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
          <span>{t.type === 'error' ? '✕' : '✓'}</span>{t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Status badge ──────────────────────────────
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
    PAID:           { label: 'Paid',           cls: 'badge-paid',      dot: '#16a34a' },
    PARTIALLY_PAID: { label: 'Partially Paid', cls: 'badge-pending',   dot: '#2563eb' },
    PENDING:        { label: 'Pending',        cls: 'badge-pending',   dot: '#ca8a04' },
    EXPIRED:        { label: 'Expired',        cls: 'badge-expired',   dot: '#94a3b8' },
    CANCELLED:      { label: 'Cancelled',      cls: 'badge-cancelled', dot: '#dc2626' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${s.cls}`}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

// ─── Edit Pricing Modal ────────────────────────
function EditPricingModal({
  invoice, onClose, onSave,
}: {
  invoice: InvoiceData;
  onClose: () => void;
  onSave: (data: { resumeBaseInr: number; linkedinBaseInr: number; notes?: string }) => Promise<void>;
}) {
  const defaults = BASE_PRICING[invoice.clientType];
  const [resumeInr,   setResumeInr]   = useState(invoice.resumeBaseInr   > 0 ? invoice.resumeBaseInr   : defaults.resume);
  const [linkedinInr, setLinkedinInr] = useState(invoice.linkedinBaseInr > 0 ? invoice.linkedinBaseInr : defaults.linkedin);
  const [notes,       setNotes]       = useState(invoice.notes ?? '');
  const [saving,      setSaving]      = useState(false);

  const fmt  = (n: number) => formatCurrency(n, invoice.currencySymbol);
  const rate = invoice.exchangeRate;
  const fee  = invoice.processingFeeRate;

  const resumeConv   = round2(resumeInr   / rate);
  const linkedinConv = round2(linkedinInr / rate);
  const subtotal     = round2((resumeInr + linkedinInr) / rate);
  const processFee   = round2(subtotal * fee);
  const total        = round2(subtotal + processFee);

  const hasResume   = invoice.resumeConverted   > 0;
  const hasLinkedin = invoice.linkedinConverted > 0;

  const handleSave = async () => {
    setSaving(true);
    await onSave({ resumeBaseInr: resumeInr, linkedinBaseInr: linkedinInr, notes: notes || undefined });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: 'var(--brand-gradient)', borderRadius: '18px 18px 0 0', padding: '20px 24px' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Edit Invoice Pricing</h2>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>
                {invoice.invoiceNumber} · {CLIENT_TYPE_LABELS[invoice.clientType]}
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Service price fields */}
          <div className="space-y-4">
            {hasResume && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  📄 Resume Writing — INR Price
                </label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14 }}>₹</span>
                    <input
                      type="number"
                      min={1}
                      value={resumeInr}
                      onChange={e => setResumeInr(Number(e.target.value))}
                      className="input"
                      style={{ paddingLeft: 28 }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 80, textAlign: 'right' }}>
                    = {fmt(resumeConv)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Default: ₹{BASE_PRICING[invoice.clientType].resume}
                </div>
              </div>
            )}

            {hasLinkedin && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  🔗 LinkedIn Optimization — INR Price
                </label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14 }}>₹</span>
                    <input
                      type="number"
                      min={1}
                      value={linkedinInr}
                      onChange={e => setLinkedinInr(Number(e.target.value))}
                      className="input"
                      style={{ paddingLeft: 28 }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 80, textAlign: 'right' }}>
                    = {fmt(linkedinConv)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Default: ₹{BASE_PRICING[invoice.clientType].linkedin}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                📝 Internal Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Reason for custom pricing, special offer, etc."
                className="input"
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Live preview */}
          <div style={{ background: '#f8faff', borderRadius: 12, border: '1px solid var(--border-blue)', padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 10 }}>
              Updated Invoice Preview
            </div>
            <div className="space-y-2">
              {hasResume   && <div className="flex justify-between text-sm"><span style={{ color: 'var(--muted)' }}>Resume Writing</span><span style={{ fontWeight: 600 }}>{fmt(resumeConv)}</span></div>}
              {hasLinkedin && <div className="flex justify-between text-sm"><span style={{ color: 'var(--muted)' }}>LinkedIn Optimization</span><span style={{ fontWeight: 600 }}>{fmt(linkedinConv)}</span></div>}
              <div className="flex justify-between text-sm" style={{ borderTop: '1px solid var(--border-blue)', paddingTop: 8 }}>
                <span style={{ color: 'var(--muted)' }}>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--muted)' }}>Processing Fee ({(fee * 100).toFixed(1)}%)</span><span>{fmt(processFee)}</span>
              </div>
              <div className="flex justify-between items-center" style={{ background: 'var(--blue)', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13 }}>New Total</span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{fmt(total)}</span>
              </div>
              {invoice.status === 'PENDING' && (
                <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                  ⚡ The Razorpay payment link will be cancelled and a new one created automatically.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-ghost flex-1" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Revision Modal ────────────────────────
function RevisionModal({
  invoice, onClose, onSave,
}: {
  invoice: InvoiceData;
  onClose: () => void;
  onSave: (data: { revisionCount: number; revisionCharge: number }) => Promise<void>;
}) {
  const fee   = REVISION_FEE[invoice.clientType];
  const free  = 2;
  const extra = Math.max(0, (invoice.revisionCount ?? 0) - free + 1);
  const charge = extra * fee;
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ revisionCount: (invoice.revisionCount ?? 0) + 1, revisionCharge: charge });
    setSaving(false);
  };

  const fmt = (n: number) => formatCurrency(n, invoice.currencySymbol);
  const chargeConverted = round2(charge / invoice.exchangeRate);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>
            🔄
          </div>
          <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text)' }}>Log a Revision</h2>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            Revision #{(invoice.revisionCount ?? 0) + 1} for {invoice.clientName}
          </div>

          <div style={{ background: '#f8faff', borderRadius: 12, border: '1px solid var(--border-blue)', padding: '14px 18px', marginTop: 18 }}>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--muted)' }}>Total revisions so far</span>
              <span className="font-semibold">{invoice.revisionCount ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--muted)' }}>Free revisions included</span>
              <span className="font-semibold" style={{ color: 'var(--green)' }}>{free}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ borderTop: '1px solid var(--border-blue)', paddingTop: 10, marginTop: 6 }}>
              <span style={{ color: 'var(--muted)' }}>Extra revision fee</span>
              <span className="font-bold" style={{ color: extra > 0 ? '#dc2626' : 'var(--green)' }}>
                {extra > 0 ? `${fmt(chargeConverted)} (₹${charge})` : 'FREE'}
              </span>
            </div>
          </div>

          {extra > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#b91c1c' }}>
              This is revision #{(invoice.revisionCount ?? 0) + 1} — beyond the 2 free revisions. An extra charge of <strong>{fmt(chargeConverted)}</strong> will be added to the invoice.
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button className="btn btn-ghost flex-1" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Logging…' : 'Log Revision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ─────────────────
function DeleteModal({
  invoice, onCancel, onConfirm, loading,
}: { invoice: InvoiceData; onCancel: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>
            🗑️
          </div>
          <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text)' }}>Delete Invoice?</h2>
          <p className="text-sm text-center mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
            Permanently delete <strong style={{ color: 'var(--text)' }}>{invoice.invoiceNumber}</strong>.
            {invoice.razorpayLinkId && invoice.status === 'PENDING' && (
              <> The Razorpay payment link will be <strong style={{ color: '#dc2626' }}>cancelled</strong>.</>
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

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { toasts, show } = useToast();

  const isJustCreated = searchParams.get('created') === 'true';

  const [invoice, setInvoice]     = useState<InvoiceData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [resending, setResending] = useState(false);
  const [showBanner, setBanner]   = useState(isJustCreated);

  const [showEditPricing, setShowEditPricing]   = useState(false);
  const [showRevision, setShowRevision]         = useState(false);
  const [showDelete, setShowDelete]             = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [markingPaid, setMarkingPaid]           = useState(false);
  const [syncing, setSyncing]                   = useState(false);

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

  const handleSavePricing = async (data: { resumeBaseInr: number; linkedinBaseInr: number; notes?: string }) => {
    const res = await fetch(`/api/invoices/${invoice!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { invoice: updated } = await res.json();
      setInvoice(updated);
      setShowEditPricing(false);
      show('Pricing updated & new Razorpay link created');
    } else {
      show('Update failed', 'error');
    }
  };

  const handleLogRevision = async (data: { revisionCount: number; revisionCharge: number }) => {
    const res = await fetch(`/api/invoices/${invoice!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { invoice: updated } = await res.json();
      setInvoice(updated);
      setShowRevision(false);
      show('Revision logged');
    } else {
      show('Failed to log revision', 'error');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/invoices/${invoice!.id}`, { method: 'DELETE' });
    if (res.ok) {
      show('Invoice deleted');
      router.push('/');
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

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--blue)', fontWeight: 600 }}>Loading invoice…</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <div style={{ color: 'var(--muted)', fontWeight: 500 }}>Invoice not found</div>
          <Link href="/" style={{ color: 'var(--blue)', fontSize: 13, marginTop: 8, display: 'inline-block' }}>← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const fmt  = (n: number) => formatCurrency(n, invoice.currencySymbol);
  const canEdit = invoice.status === 'PENDING';

  return (
    <AppShell>
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">

        {/* Success Banner */}
        {showBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-xs animate-fade-in">
            <span className="text-2xl">✅</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm sm:text-base text-emerald-900">Invoice Created Successfully!</div>
              <div className="text-xs text-emerald-700 mt-0.5">Email notification dispatched to {invoice.clientEmail} · Payment gateway active</div>
            </div>
          </div>
        )}

        {/* ── Top Bar: Navigation & Primary Actions ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <Link href="/" className="text-[#B8935B] hover:text-[#9A7540] transition-colors flex items-center gap-1">
                <span>←</span> Invoices
              </Link>
              <span>/</span>
              <span className="text-slate-600 font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Desktop & Tablet Top Action Buttons */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                onClick={() => setShowEditPricing(true)}
              >
                <span>✏️</span> Edit Pricing
              </button>
            )}
            <button
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
              onClick={() => setShowRevision(true)}
            >
              <span>🔄</span> Revision
            </button>
            <button
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              onClick={handleResend}
              disabled={resending}
            >
              <span>{resending ? '⏳' : '📧'}</span>
              <span>{resending ? 'Sending…' : 'Resend Email'}</span>
            </button>

            {invoice.status === 'PENDING' && (
              (() => {
                const isPayPal = invoice.paymentGateway === 'PAYPAL';
                const payUrl   = isPayPal ? invoice.paypalPaymentUrl : invoice.razorpayLinkUrl;
                return payUrl ? (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-xs font-bold transition-all shadow-sm shadow-[#B8935B]/20 flex items-center gap-1.5 active:scale-95 hover:opacity-95"
                  >
                    <span>💳</span>
                    <span>{isPayPal ? 'PayPal Link ↗' : 'Payment Link ↗'}</span>
                  </a>
                ) : null;
              })()
            )}

            {invoice.status !== 'PAID' && (
              <button
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                onClick={handleMarkPaid}
                disabled={markingPaid}
              >
                <span>✓</span>
                <span>{markingPaid ? 'Updating…' : 'Mark as Paid'}</span>
              </button>
            )}

            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                onClick={handleSyncRazorpay}
                disabled={syncing}
              >
                <span>↻</span>
                <span>{syncing ? 'Syncing…' : 'Sync Gateway'}</span>
              </button>
            )}

            <button
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
              onClick={() => setShowDelete(true)}
            >
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>

        {/* ── Mobile Quick Actions Card (< sm screens) ── */}
        <div className="block sm:hidden bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          {/* Primary Mobile Action */}
          {invoice.status === 'PENDING' && (
            (() => {
              const isPayPal = invoice.paymentGateway === 'PAYPAL';
              const payUrl   = isPayPal ? invoice.paypalPaymentUrl : invoice.razorpayLinkUrl;
              return payUrl ? (
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-sm font-bold shadow-md shadow-[#B8935B]/20 flex items-center justify-center gap-2 active:scale-98 text-center"
                >
                  <span>💳</span>
                  <span>Open {isPayPal ? 'PayPal' : 'Razorpay'} Payment Portal ↗</span>
                </a>
              ) : null;
            })()
          )}

          {invoice.status !== 'PAID' && (
            <button
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              onClick={handleMarkPaid}
              disabled={markingPaid}
            >
              <span>✓</span>
              <span>{markingPaid ? 'Updating Status…' : 'Mark as Paid'}</span>
            </button>
          )}

          {/* Secondary Mobile Buttons Grid */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {canEdit && (
              <button
                className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1"
                onClick={() => setShowEditPricing(true)}
              >
                <span>✏️</span> Edit
              </button>
            )}
            <button
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1"
              onClick={() => setShowRevision(true)}
            >
              <span>🔄</span> Revision
            </button>
            <button
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1 disabled:opacity-50"
              onClick={handleResend}
              disabled={resending}
            >
              <span>📧</span> Resend
            </button>
            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button
                className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1 disabled:opacity-50"
                onClick={handleSyncRazorpay}
                disabled={syncing}
              >
                <span>↻</span> Sync
              </button>
            )}
            <button
              className="py-2 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1"
              onClick={() => setShowDelete(true)}
            >
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>

        {/* ── Main Layout: Invoice Card + Desktop Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px] gap-6 sm:gap-8 items-start">
          
          {/* ── INVOICE CARD ── */}
          <div className="w-full">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">

              {/* 1. Header with Obsidian Gradient */}
              <div className="bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#2D2418] text-white p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <Logo variant="horizontal" size={32} dark />
                    <div className="text-slate-400 text-[11px] sm:text-xs mt-2 flex items-center gap-1">
                      <span>catalyst@theripplenexus.com</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl sm:rounded-2xl p-3 sm:p-4 inline-block">
                      <div className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF7A] mb-0.5">
                        Invoice
                      </div>
                      <div className="font-mono text-base sm:text-xl font-black text-white tracking-tight">
                        {invoice.invoiceNumber}
                      </div>
                    </div>
                    <div className="block sm:hidden">
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                </div>

                {/* 3 Compact Meta Pills */}
                <div className="grid grid-cols-3 gap-2 mt-4 sm:mt-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 sm:p-3 text-center sm:text-left">
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Issue Date</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-0.5 sm:mt-1">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 sm:p-3 text-center sm:text-left">
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Date</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-0.5 sm:mt-1">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 sm:p-3 text-center sm:text-left">
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Currency</div>
                    <div className="text-white font-semibold text-xs sm:text-sm mt-0.5 sm:mt-1">{invoice.currency} ({invoice.currencySymbol})</div>
                  </div>
                </div>
              </div>

              {/* Accent Divider */}
              <div className="h-1 bg-gradient-to-r from-[#B8935B] via-[#D4AF7A] to-[#B8935B]" />

              {/* 2. Client & Service Package Info */}
              <div className="bg-[#FBF8F3]/70 border-b border-[#E8DDD0] p-4 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  
                  {/* Bill To */}
                  <div className="bg-white/95 p-4 sm:p-5 rounded-2xl border border-[#E8DDD0] shadow-2xs space-y-3">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#7A5B2E] flex items-center gap-1.5">
                      <span>👤</span> Billed To Client
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A0B0D] to-[#B8935B] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                        {invoice.clientName.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-extrabold text-slate-900 truncate">
                          {invoice.clientName}
                        </div>
                        {invoice.companyName && (
                          <div className="text-xs text-slate-500 font-medium truncate">{invoice.companyName}</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] shrink-0">✉</span>
                        <a href={`mailto:${invoice.clientEmail}`} className="text-slate-800 font-semibold hover:text-[#B8935B] underline truncate">
                          {invoice.clientEmail}
                        </a>
                      </div>
                      {invoice.clientPhone && (
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] shrink-0">📞</span>
                          <a href={`tel:${invoice.clientPhone}`} className="text-slate-800 font-semibold hover:text-[#B8935B]">
                            {invoice.clientPhone}
                          </a>
                        </div>
                      )}
                      {invoice.country && (
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] shrink-0">📍</span>
                          <span className="text-slate-600 font-medium">{invoice.country}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Package & Pricing Strategy */}
                  <div className="bg-white/80 p-4 rounded-xl border border-[#E8DDD0]/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#7A5B2E] mb-1.5 flex items-center gap-1.5">
                      <span>💼</span> Scope &amp; Deliverables
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#B8935B]/15 text-[#7A5B2E] border border-[#B8935B]/30">
                        {CLIENT_TYPE_LABELS[invoice.clientType]}
                      </span>
                      {invoice.customPricing && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Custom Pricing
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-mono">
                      FX Normalization: 1 INR = {invoice.exchangeRate.toFixed(5)} {invoice.currency}
                    </div>

                    {invoice.notes && (
                      <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-700">Memo:</span> {invoice.notes}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* 3. Line Items Section */}
              <div className="p-4 sm:p-8">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 sm:mb-4">
                  Itemized Deliverables &amp; Services
                </div>

                {/* 3a. Mobile Receipt Card View (< sm screens) */}
                <div className="block sm:hidden space-y-2.5">
                  {((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]).map((item, idx) => {
                    const lt = round2(item.qty * item.unitPrice);
                    const isFree = lt === 0;
                    return (
                      <div key={item.id ?? idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-slate-900 flex-1 leading-snug">
                            <span className="text-[#B8935B] font-mono mr-1">#{idx + 1}</span>
                            {item.description}
                          </div>
                          {isFree ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              FREE
                            </span>
                          ) : (
                            <span className="font-mono font-extrabold text-sm text-slate-900">
                              {fmt(lt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                          <span>Quantity: <strong className="text-slate-700">{item.qty}</strong></span>
                          <span>Unit Price: <strong className="text-slate-700">{isFree ? 'FREE' : fmt(item.unitPrice)}</strong></span>
                        </div>
                      </div>
                    );
                  })}

                  {(invoice.revisionCharge ?? 0) > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-rose-900">🔄 Extra Revision #{invoice.revisionCount}</span>
                        <span className="font-mono font-extrabold text-xs text-rose-700">
                          {fmt(round2((invoice.revisionCharge ?? 0) / invoice.exchangeRate))}
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-600">Charged revision outside free 2-round allowance</div>
                    </div>
                  )}
                </div>

                {/* 3b. Desktop / Tablet Table View (>= sm screens) */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="px-4 py-3 text-center w-12">#</th>
                        <th className="px-4 py-3">Service / Deliverable</th>
                        <th className="px-4 py-3 text-center w-20">Qty</th>
                        <th className="px-4 py-3 text-right w-36">Unit Price</th>
                        <th className="px-4 py-3 text-right w-36">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]).map((item, idx) => {
                        const lt = round2(item.qty * item.unitPrice);
                        const isFree = lt === 0;
                        return (
                          <tr key={item.id ?? idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400 font-bold">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-800">
                              {item.description}
                            </td>
                            <td className="px-4 py-3.5 text-center text-slate-600 font-mono">
                              {item.qty}
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-600 font-mono">
                              {isFree ? '—' : fmt(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold">
                              {isFree ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                                  FREE
                                </span>
                              ) : (
                                <span className="text-slate-900 font-extrabold">{fmt(lt)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {(invoice.revisionCharge ?? 0) > 0 && (
                        <tr className="bg-rose-50/50">
                          <td className="px-4 py-3 text-center text-rose-500 font-bold">+</td>
                          <td className="px-4 py-3 font-semibold text-rose-900">
                            🔄 Extra Revision #{invoice.revisionCount}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-rose-700">1</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700">
                            {fmt(round2((invoice.revisionCharge ?? 0) / invoice.exchangeRate))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-rose-700">
                            {fmt(round2((invoice.revisionCharge ?? 0) / invoice.exchangeRate))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. Financials Summary / Totals Box */}
                <div className="mt-5 flex flex-col sm:items-end">
                  <div className="w-full sm:w-80 space-y-2 text-xs sm:text-sm bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono font-bold text-slate-800">{fmt(invoice.subtotalConverted)}</span>
                    </div>

                    {(invoice.discountRate ?? 0) > 0 && (
                      <div className="flex justify-between items-center text-emerald-700 font-medium">
                        <span>Discount ({invoice.discountRate}%)</span>
                        <span className="font-mono font-bold">−{fmt(invoice.discountAmount)}</span>
                      </div>
                    )}

                    {(invoice.taxRate ?? 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Tax ({invoice.taxRate}%)</span>
                        <span className="font-mono font-bold">+{fmt(invoice.taxAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-slate-600 pb-2 border-b border-slate-200">
                      <span>Processing Fee ({(invoice.processingFeeRate * 100).toFixed(1)}%)</span>
                      <span className="font-mono font-bold text-slate-800">{fmt(invoice.processingFeeConverted)}</span>
                    </div>

                    {/* Total Grand Card */}
                    <div className="bg-gradient-to-r from-[#0A0B0D] to-[#1C1812] text-white p-3.5 rounded-xl flex items-center justify-between shadow-xs">
                      <span className="text-xs font-bold text-[#D4AF7A]">Total Payable ({invoice.currency})</span>
                      <span className="font-mono text-base sm:text-lg font-black text-white">
                        {fmt(invoice.totalPayable)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 5. Payment Gateways / Settlement CTAs */}
              {invoice.status === 'PENDING' && (
                <div className="p-4 sm:p-8 bg-slate-50/70 border-t border-slate-200 text-center">
                  {invoice.paymentGateway !== 'PAYPAL' && invoice.razorpayLinkUrl && (
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="text-xs text-slate-500">
                        Official Payment Portal &mdash; UPI · Cards · Net Banking via <strong>Razorpay</strong>
                      </div>
                      <a
                        href={invoice.razorpayLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-sm font-extrabold shadow-md shadow-[#B8935B]/20 hover:opacity-95 transition-all active:scale-98"
                      >
                        Pay {fmt(invoice.totalPayable)} Now ↗
                      </a>
                      <div className="text-[10px] text-slate-400 font-mono break-all">
                        {invoice.razorpayLinkUrl}
                      </div>
                    </div>
                  )}

                  {invoice.paymentGateway === 'PAYPAL' && invoice.paypalPaymentUrl && (
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="text-xs text-slate-500">
                        International Settlement via <strong className="text-[#003087]">PayPal</strong>
                      </div>
                      <a
                        href={invoice.paypalPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-xl bg-[#003087] hover:bg-[#002566] text-white text-sm font-extrabold shadow-md transition-all active:scale-98"
                      >
                        Pay {fmt(invoice.totalPayable)} via PayPal ↗
                      </a>
                      <div className="text-[10px] text-slate-400 font-mono break-all">
                        {invoice.paypalPaymentUrl}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {invoice.status === 'PAID' && (
                <div className="p-4 sm:p-7 bg-emerald-50 border-t border-emerald-200 text-center space-y-1">
                  <div className="text-2xl">✅</div>
                  <div className="font-extrabold text-emerald-900 text-base">Payment Settled &amp; Verified</div>
                  {invoice.paidAt && (
                    <div className="text-xs text-emerald-700">
                      Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy, h:mm a')}
                    </div>
                  )}
                </div>
              )}

              {/* 6. Terms & Conditions */}
              <div className="p-4 sm:p-8 bg-slate-50/50 border-t border-slate-200">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">
                  Terms &amp; Operational Guarantee
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500">
                  {[
                    'No refund once strategy drafting commences',
                    'Delivery within 2–4 business days',
                    '2 complimentary revision rounds included',
                    'Scope extensions are chargeable',
                    'Confidentiality strictly maintained',
                    'Official invoice valid for tax record',
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="text-[#B8935B] font-black">•</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7. Footer */}
              <div className="p-3.5 sm:p-6 bg-[#0A0B0D] text-white flex flex-col sm:flex-row items-center justify-between gap-2">
                <Logo variant="horizontal" size={26} dark />
                <div className="font-mono text-xs text-slate-400">
                  Doc ID: {invoice.invoiceNumber}
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT PANEL (Desktop & Collapsible Mobile Telemetry) ── */}
          <div className="space-y-4 w-full">
            
            {/* Status & Telemetry Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 sm:mb-4 flex items-center justify-between">
                <span>Invoice Telemetry</span>
                <span className="text-xs font-normal text-slate-400 lg:hidden">Details</span>
              </div>
              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Gateway</span>
                  <span className="font-bold text-slate-800">{invoice.paymentGateway ?? 'RAZORPAY'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email Status</span>
                  <span className="font-semibold text-slate-800">
                    {invoice.emailSentAt ? `Sent ${format(new Date(invoice.emailSentAt), 'dd MMM')}` : 'Not sent'}
                  </span>
                </div>
                {invoice.emailResendCount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Resend Count</span>
                    <span className="font-mono font-bold text-slate-800">{invoice.emailResendCount}×</span>
                  </div>
                )}
                {invoice.razorpayLinkId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Gateway ID</span>
                    <span className="font-mono text-xs font-bold text-blue-600 truncate max-w-[140px]">
                      {invoice.razorpayLinkId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Revisions Logged</span>
                  <span className="font-mono font-bold text-slate-800">
                    {invoice.revisionCount ?? 0} ({Math.max(0, (invoice.revisionCount ?? 0) - 2)} chargeable)
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Only: Financials Quick Card (hidden on mobile to avoid duplication) */}
            <div className="hidden lg:block bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">
                Financial Summary
              </div>
              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Base (INR)</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹{(invoice.resumeBaseInr + invoice.linkedinBaseInr).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Net Subtotal</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(invoice.subtotalConverted)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Processing Fee</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(invoice.processingFeeConverted)}</span>
                </div>
                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total Payable</span>
                  <span className="font-mono font-black text-base text-[#B8935B]">{fmt(invoice.totalPayable)}</span>
                </div>
              </div>
            </div>

            {/* Desktop Quick Actions Card */}
            <div className="hidden sm:block bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                Quick Shortcuts
              </div>
              <Link
                href="/invoices/new"
                className="block w-full py-2.5 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs font-bold transition-all text-center shadow-xs"
              >
                + Create New Invoice
              </Link>
            </div>

          </div>

        </div>

      </div>

      {/* ── MODALS ── */}
      {showEditPricing && invoice && (
        <EditPricingModal invoice={invoice} onClose={() => setShowEditPricing(false)} onSave={handleSavePricing} />
      )}
      {showRevision && invoice && (
        <RevisionModal invoice={invoice} onClose={() => setShowRevision(false)} onSave={handleLogRevision} />
      )}
      {showDelete && invoice && (
        <DeleteModal invoice={invoice} onCancel={() => setShowDelete(false)} onConfirm={handleDelete} loading={deleting} />
      )}

      <Toasts toasts={toasts} />
    </AppShell>
  );
}
