'use client';
// src/app/invoices/[id]/page.tsx — Invoice Detail with Edit Pricing + Delete

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency, BASE_PRICING, REVISION_FEE, round2 } from '@/lib/pricing';
import { LogoSidebar, Logo } from '@/components/Logo';

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
    PAID:      { label: 'Paid',      cls: 'badge-paid',      dot: '#16a34a' },
    PENDING:   { label: 'Pending',   cls: 'badge-pending',   dot: '#ca8a04' },
    EXPIRED:   { label: 'Expired',   cls: 'badge-expired',   dot: '#94a3b8' },
    CANCELLED: { label: 'Cancelled', cls: 'badge-cancelled', dot: '#dc2626' },
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
        <div style={{ background: 'linear-gradient(135deg,#0f1c3d,#1f56d4)', borderRadius: '18px 18px 0 0', padding: '20px 24px' }}>
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
  const desc = { resume: 'ATS-optimised, keyword-rich', linkedin: 'Visibility boost, recruiter magnet', coverLetter: 'Customisable template' };
  const canEdit = invoice.status === 'PENDING';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="px-5 py-5 border-b border-white/10">
          <LogoSidebar size={34} />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: '/',             icon: '⬛', label: 'Dashboard' },
            { href: '/invoices/new', icon: '＋', label: 'New Invoice' },
            { href: '/invoices',     icon: '📄', label: 'All Invoices' },
          ].map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <span className="w-5 text-center text-base">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>v2.0.0 · Internal</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="page-wrapper" style={{ padding: '32px 36px' }}>

        {/* Success Banner */}
        {showBanner && (
          <div style={{ background: 'var(--green-light)', border: '1px solid #86efac', color: '#166534', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700 }}>Invoice Created Successfully!</div>
              <div style={{ fontSize: 13, opacity: .8 }}>Email sent to {invoice.clientEmail} · Payment link ready</div>
            </div>
          </div>
        )}

        {/* Breadcrumb + Actions */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Dashboard</Link>
            <span>/</span>
            <span className="mono font-bold" style={{ color: 'var(--blue)' }}>{invoice.invoiceNumber}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canEdit && (
              <button className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setShowEditPricing(true)}>
                ✏️ Edit Pricing
              </button>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setShowRevision(true)}>
              🔄 Log Revision
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, padding: '8px 14px' }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? '⏳ Sending…' : '📧 Resend Email'}
            </button>
            {invoice.razorpayLinkUrl && invoice.status === 'PENDING' && (
              <a href={invoice.razorpayLinkUrl} target="_blank" rel="noopener noreferrer"
                className="btn btn-primary" style={{ fontSize: 13, padding: '8px 14px' }}>
                💳 Payment Link ↗
              </a>
            )}
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setShowDelete(true)}>
              🗑️ Delete
            </button>
          </div>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
          {/* ── INVOICE CARD ── */}
          <div>
            <div className="card overflow-hidden" style={{ boxShadow: '0 4px 40px rgba(31,86,212,.08)' }}>

              {/* Invoice Header */}
              <div style={{ background: 'linear-gradient(135deg,#0f1c3d 0%,#1f56d4 100%)', padding: '32px 36px' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <Logo variant="horizontal" size={38} dark />
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 16 }}>support@theripplenexus.com</div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>www.theripplenexus.com</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 18px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>Invoice</div>
                      <div className="mono" style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginTop: 2 }}>{invoice.invoiceNumber}</div>
                      <div style={{ marginTop: 8 }}>
                        <StatusBadge status={invoice.status} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    ['Issue Date', format(new Date(invoice.invoiceDate), 'dd MMM yyyy')],
                    ['Due Date',   format(new Date(invoice.dueDate),     'dd MMM yyyy')],
                    ['Currency',   `${invoice.currency} (${invoice.currencySymbol})`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginTop: 3 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accent bar */}
              <div style={{ height: 3, background: 'linear-gradient(90deg,#3FBD8B,#1f56d4,#3FBD8B)' }} />

              {/* Client + Package */}
              <div style={{ background: '#f8faff', borderBottom: '1px solid var(--border-blue)', padding: '20px 36px' }}>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Bill To</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{invoice.clientName}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{invoice.clientEmail}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.clientPhone}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.country}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Package</div>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                      {CLIENT_TYPE_LABELS[invoice.clientType]}
                    </span>
                    {invoice.customPricing && (
                      <div style={{ fontSize: 11, background: '#fef9c3', color: '#92400e', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginLeft: 8 }}>
                        Custom Pricing
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                      Exchange Rate: 1 INR = {invoice.exchangeRate.toFixed(5)} {invoice.currency}
                    </div>
                    {invoice.notes && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                        📝 {invoice.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Services Table */}
              <div style={{ padding: '24px 36px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>Services</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f0f4ff' }}>
                      {['Service', 'Description', 'Base (INR)', 'Amount'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Amount' || h === 'Base (INR)' ? 'right' : 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.resumeConverted > 0 && (
                      <tr style={{ borderBottom: '1px solid #f0f4ff' }}>
                        <td style={{ padding: '14px 14px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>📄 Resume Writing</td>
                        <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--muted)', maxWidth: 200 }}>{desc.resume}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12, color: 'var(--muted)' }} className="mono">₹{invoice.resumeBaseInr.toLocaleString()}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(invoice.resumeConverted)}</td>
                      </tr>
                    )}
                    {invoice.linkedinConverted > 0 && (
                      <tr style={{ borderBottom: '1px solid #f0f4ff' }}>
                        <td style={{ padding: '14px 14px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>🔗 LinkedIn Optimization</td>
                        <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--muted)', maxWidth: 200 }}>{desc.linkedin}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12, color: 'var(--muted)' }} className="mono">₹{invoice.linkedinBaseInr.toLocaleString()}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(invoice.linkedinConverted)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '14px 14px', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>✉️ Cover Letter Template</td>
                      <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--muted)' }}>{desc.coverLetter}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <span style={{ background: 'var(--green-light)', color: '#15803d', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>FREE</span>
                      </td>
                    </tr>
                    {(invoice.revisionCharge ?? 0) > 0 && (
                      <tr style={{ borderTop: '1px solid #f0f4ff' }}>
                        <td style={{ padding: '14px 14px', fontWeight: 600, fontSize: 14, color: '#dc2626' }}>🔄 Extra Revisions</td>
                        <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--muted)' }}>Revision #{invoice.revisionCount} — beyond 2 free</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12, color: 'var(--muted)' }} className="mono">₹{invoice.revisionCharge}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#dc2626' }}>{fmt(round2((invoice.revisionCharge ?? 0) / invoice.exchangeRate))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ maxWidth: 300, marginLeft: 'auto', marginTop: 20 }}>
                  <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--muted)' }}>
                    <span>Subtotal</span><span className="font-semibold">{fmt(invoice.subtotalConverted)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3" style={{ color: 'var(--muted)' }}>
                    <span>Processing Fee ({(invoice.processingFeeRate * 100).toFixed(1)}%)</span>
                    <span className="font-semibold">{fmt(invoice.processingFeeConverted)}</span>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg,#1f56d4,#1a42a0)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13 }}>Total Payable ({invoice.currency})</span>
                    <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{fmt(invoice.totalPayable)}</span>
                  </div>
                </div>
              </div>

              {/* CTA / Paid state */}
              {invoice.status === 'PENDING' && invoice.razorpayLinkUrl && (
                <div style={{ background: '#f8faff', borderTop: '1px solid var(--border-blue)', padding: '24px 36px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Secure payment via Razorpay &nbsp;🔒&nbsp; UPI · Cards · Net Banking</div>
                  <a href={invoice.razorpayLinkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 36px', boxShadow: '0 4px 20px rgba(31,86,212,.35)' }}>
                    💳 Pay {fmt(invoice.totalPayable)} Now
                  </a>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, wordBreak: 'break-all' }}>
                    {invoice.razorpayLinkUrl}
                  </div>
                </div>
              )}

              {invoice.status === 'PAID' && (
                <div style={{ background: 'var(--green-light)', borderTop: '1px solid #86efac', padding: '20px 36px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 16 }}>Payment Received</div>
                  {invoice.paidAt && (
                    <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>
                      Paid on {format(new Date(invoice.paidAt), 'dd MMM yyyy, h:mm a')}
                    </div>
                  )}
                </div>
              )}

              {/* Value prop */}
              <div style={{ borderTop: '1px solid #f0f4ff', padding: '16px 36px' }}>
                <blockquote style={{ borderLeft: '3px solid var(--green)', background: '#f0fff8', borderRadius: '0 8px 8px 0', padding: '12px 16px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.7, margin: 0 }}>
                  "This investment is designed to improve recruiter visibility and interview conversion — giving your career the competitive edge it deserves."
                </blockquote>
              </div>

              {/* Terms */}
              <div style={{ background: '#f8faff', borderTop: '1px solid var(--border)', padding: '16px 36px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Terms & Conditions</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {[
                    'No refund after work commences',
                    'Delivery within 2–4 business days',
                    '2 free revisions included',
                    'Additional revisions are chargeable',
                    'No job placement guarantee',
                    'All data kept strictly confidential',
                  ].map(t => (
                    <div key={t} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--green)' }}>•</span>{t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ background: 'var(--navy)', padding: '16px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <LogoSidebar size={28} />
                <div className="mono" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{invoice.invoiceNumber}</div>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="space-y-4">
            {/* Status */}
            <div className="card p-5">
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>Invoice Status</div>
              <div className="space-y-3">
                {[
                  ['Status',   <StatusBadge key="s" status={invoice.status} />],
                  ['Email',    invoice.emailSentAt ? `Sent ${format(new Date(invoice.emailSentAt), 'dd MMM')}` : 'Not sent'],
                  ...(invoice.emailResendCount > 0 ? [['Resends', `${invoice.emailResendCount}×`]] : []),
                  ...(invoice.razorpayLinkId ? [['Razorpay ID', <span key="r" className="mono text-xs truncate" style={{ color: 'var(--blue)', maxWidth: 120, display: 'block' }}>{invoice.razorpayLinkId}</span>]] : []),
                  ['Revisions', `${invoice.revisionCount ?? 0} (${Math.max(0, (invoice.revisionCount ?? 0) - 2)} chargeable)`],
                ].map(([label, value], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financials */}
            <div className="card p-5">
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>Financials</div>
              <div className="space-y-2.5">
                {[
                  ['Base (INR)', `₹${(invoice.resumeBaseInr + invoice.linkedinBaseInr).toLocaleString()}`],
                  ['Converted', fmt(invoice.subtotalConverted)],
                  ['Processing Fee', fmt(invoice.processingFeeConverted)],
                  ...(invoice.revisionCharge > 0 ? [['Revision Charge', fmt(round2((invoice.revisionCharge ?? 0) / invoice.exchangeRate))]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }} className="mono">{value}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--blue)' }}>Total</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--blue)' }}>{fmt(invoice.totalPayable)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-5 space-y-2">
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>Quick Actions</div>
              {canEdit && (
                <button className="btn btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => setShowEditPricing(true)}>
                  ✏️ Edit Pricing
                </button>
              )}
              <button className="btn btn-ghost w-full" style={{ justifyContent: 'center' }} onClick={() => setShowRevision(true)}>
                🔄 Log Revision
              </button>
              <button className="btn btn-ghost w-full" style={{ justifyContent: 'center' }} onClick={handleResend} disabled={resending}>
                📧 {resending ? 'Sending…' : 'Resend Email'}
              </button>
              <Link href="/invoices/new" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
                + New Invoice
              </Link>
              <button className="btn btn-danger w-full" style={{ justifyContent: 'center' }} onClick={() => setShowDelete(true)}>
                🗑️ Delete Invoice
              </button>
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}
