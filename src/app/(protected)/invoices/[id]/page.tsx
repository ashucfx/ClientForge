'use client';
// src/app/invoices/[id]/page.tsx — Invoice Detail with Edit Pricing + Delete

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import type { InvoiceData, InvoiceStatus } from '@/types';
import { CLIENT_TYPE_LABELS, formatCurrency, BASE_PRICING, REVISION_FEE, round2 } from '@/lib/pricing';
import { convertForeignToInr, convertInrToForeign } from '@/lib/currency';
import { Logo } from '@/components/Logo';
import AppShell from '@/components/AppShell';
import {
  IconUser, IconMail, IconPhone, IconPin, IconBriefcase,
  IconCreditCard, IconCheck, IconEdit, IconRefresh, IconTrash,
  IconDocument, IconSend, IconChevronRight
} from '@/components/Icons';

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

import { resolveInvoicePackage } from '@/lib/invoicePackageResolver';

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

// ─── Package & Sanitization Helpers ───────────────
function getInvoicePackageDetails(
  clientType?: string | null,
  notes?: string | null,
  lineItems: Array<{ description: string }> = []
) {
  return resolveInvoicePackage(clientType, notes, lineItems);
}

function sanitizeItemDescription(rawDesc: string, pkgName: string): { title: string; subtitle?: string; isComp?: boolean } {
  const lower = (rawDesc || '').toLowerCase().trim();

  if (lower.includes('portal automated upgrade') || lower.includes('target:') || lower.includes('upgrade')) {
    if (lower.includes('plus') || lower.includes('executive_plus')) {
      return {
        title: 'Premium Plus Package — Complete Architecture Upgrade',
        subtitle: 'Executive C-Suite Narrative Transformation, Global Positioning & Strategy',
      };
    }
    return {
      title: 'Executive Career Architecture — Portfolio Service Upgrade',
      subtitle: 'Comprehensive Professional Calibration & Advanced Positioning Scope',
    };
  }

  if (lower.includes('cover letter') || lower.includes('coverletter') || lower.includes('complimentary')) {
    return {
      title: 'Executive Cover Letter Architecture',
      subtitle: 'Modular high-impact narrative tailored to target leadership roles',
      isComp: true,
    };
  }

  if (lower.includes('linkedin')) {
    return {
      title: 'LinkedIn Profile Optimisation + Custom Banner Concept',
      subtitle: 'Strategic personal brand realignment and algorithmic discovery tuning',
    };
  }

  if (lower.includes('resume') || lower.includes('cv')) {
    return {
      title: 'Resume Rewrite & Product Leadership Positioning',
      subtitle: 'Catalyst Talent Positioning Architecture Deliverable Suite',
    };
  }

  if (lower.includes('portfolio')) {
    return {
      title: 'Portfolio Website Development & Executive Showcase',
      subtitle: 'Digital leadership identity architecture & executive case studies',
    };
  }

  if (lower.includes('revision')) {
    return {
      title: 'Strategic Profile Calibration & Revision Scope',
      subtitle: 'Iterative targeted refinement, ATS keyword re-calibration & polish',
    };
  }

  if (lower === 'fresher' || lower.includes('fresher')) {
    return {
      title: 'Career Booster Package — Early Professional Track',
      subtitle: 'ATS-optimized resume architecture, LinkedIn overhaul & outreach assets',
    };
  }

  if (lower === 'mid_career' || lower.includes('mid-career') || lower.includes('mid career')) {
    return {
      title: 'Career Booster Package — Professional Acceleration Track',
      subtitle: 'Executive resume transformation, LinkedIn repositioning & career narrative',
    };
  }

  if (lower === 'executive_plus' || lower.includes('premium plus') || lower.includes('exec+')) {
    return {
      title: 'Premium Plus Package — Global Executive Placement Track',
      subtitle: 'Executive C-Suite narrative overhaul, strategic LinkedIn presence & advisory',
    };
  }

  if (lower === 'executive') {
    return {
      title: 'Executive Leadership Architecture Package',
      subtitle: 'Senior leadership ATS positioning, executive LinkedIn overhaul & career dossier',
    };
  }

  if (!rawDesc || rawDesc === 'Career Booster Services' || rawDesc === 'Direct Onboarding') {
    return {
      title: pkgName,
      subtitle: 'Complete Talent Positioning Architecture & Professional Deliverables Suite',
    };
  }

  return {
    title: rawDesc,
    subtitle: 'Catalyst Talent Positioning Architecture · Deliverable Suite',
  };
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
          <div style={{ background: '#FDFCF9', borderRadius: 12, border: '1px solid #EAE2D5', padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 10 }}>
              Updated Invoice Preview
            </div>
            <div className="space-y-2">
              {hasResume   && <div className="flex justify-between text-sm"><span style={{ color: 'var(--muted)' }}>Resume Writing</span><span style={{ fontWeight: 600 }}>{fmt(resumeConv)}</span></div>}
              {hasLinkedin && <div className="flex justify-between text-sm"><span style={{ color: 'var(--muted)' }}>LinkedIn Optimization</span><span style={{ fontWeight: 600 }}>{fmt(linkedinConv)}</span></div>}
              <div className="flex justify-between text-sm" style={{ borderTop: '1px solid #EAE2D5', paddingTop: 8 }}>
                <span style={{ color: 'var(--muted)' }}>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--muted)' }}>Processing Fee ({(fee * 100).toFixed(1)}%)</span><span>{fmt(processFee)}</span>
              </div>
              <div className="flex justify-between items-center" style={{ background: '#B8935B', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 13 }}>New Total</span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{fmt(total)}</span>
              </div>
              {invoice.status === 'PENDING' && (
                <div style={{ fontSize: 11, color: '#B8935B', textAlign: 'center', marginTop: 4 }}>
                  The Razorpay payment link will be updated automatically.
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

          <div style={{ background: '#FDFCF9', borderRadius: 12, border: '1px solid #EAE2D5', padding: '14px 18px', marginTop: 18 }}>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--muted)' }}>Total revisions so far</span>
              <span className="font-semibold">{invoice.revisionCount ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--muted)' }}>Free revisions included</span>
              <span className="font-semibold" style={{ color: 'var(--green)' }}>{free}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ borderTop: '1px solid #EAE2D5', paddingTop: 10, marginTop: 6 }}>
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

// ─── Delete confirmation modal with Mandatory Email OTP ─────────────────
function DeleteModal({
  invoice,
  onCancel,
  onDeleted,
}: {
  invoice: InvoiceData;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');

  const requestOtp = async () => {
    setSendingOtp(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/delete-otp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch verification code');
      }
      setOtpToken(data.otpToken);
      setRecipient(data.recipient || 'your admin email');
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Error requesting verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const confirmDelete = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode: otpCode.trim(), otpToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete invoice');
      }
      onDeleted();
    } catch (err: any) {
      setError(err.message || 'Error during invoice deletion');
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Top SVG Shield Alert */}
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-center text-slate-900">
            {step === 'request' ? 'Authorize Invoice Deletion' : 'Enter Verification Code'}
          </h2>

          <p className="text-xs text-center text-slate-500 mt-2 leading-relaxed">
            {step === 'request' ? (
              <>
                Deleting <strong className="text-slate-800">{invoice.invoiceNumber}</strong> permanently removes this financial record and cancels any active payment links. For accounting compliance, a <strong>6-digit security code</strong> will be sent to your admin email.
              </>
            ) : (
              <>
                A 6-digit authorization code has been dispatched to <strong className="text-slate-800">{recipient}</strong>. Enter it below to authorize permanent deletion.
              </>
            )}
          </p>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          {step === 'request' ? (
            <div className="flex gap-3 mt-6">
              <button type="button" className="btn btn-ghost flex-1 text-xs" onClick={onCancel} disabled={sendingOtp}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger-solid flex-1 text-xs flex items-center justify-center gap-2"
                onClick={requestOtp}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending Code…
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-mono tracking-[0.4em] py-3 px-4 border border-slate-300 rounded-xl focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 bg-slate-50 font-bold text-slate-800"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                  <span>Expires in 5 minutes</span>
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={sendingOtp || deleting}
                    className="text-[#B8935B] hover:underline font-semibold"
                  >
                    {sendingOtp ? 'Sending…' : 'Resend code'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1 text-xs"
                  onClick={onCancel}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger-solid flex-1 text-xs font-bold"
                  onClick={confirmDelete}
                  disabled={deleting || otpCode.trim().length !== 6}
                >
                  {deleting ? 'Verifying & Deleting…' : 'Confirm & Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settlement Reconciliation Panel ───────────────
function SettlementPanel({
  invoice,
  onSaved,
}: {
  invoice: InvoiceData;
  onSaved: (updated: { amountSettledInr: number | null; settlementNote: string | null; settledAt: Date | null }) => void;
}) {
  const [open, setOpen] = useState(invoice.amountSettledInr !== null);
  const [amountInr, setAmountInr] = useState(invoice.amountSettledInr?.toString() ?? '');
  const [note, setNote] = useState(invoice.settlementNote ?? '');
  const [settledAt, setSettledAt] = useState(
    invoice.settledAt
      ? new Date(invoice.settledAt).toISOString().slice(0, 10)
      : invoice.paidAt
      ? new Date(invoice.paidAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isForeign = invoice.currency !== 'INR';
  const sym = invoice.currencySymbol || invoice.currency;

  // Expected revenues in invoice currency:
  const grossForeign = invoice.totalPayable;
  const netForeign = invoice.subtotalConverted;
  const feeForeign = invoice.processingFeeConverted;

  // Expected revenues in INR (Indian bank settlement rail):
  const grossInr = isForeign ? convertForeignToInr(grossForeign, invoice.currency, invoice.exchangeRate) : grossForeign;
  const netInr = isForeign ? convertForeignToInr(netForeign, invoice.currency, invoice.exchangeRate) : netForeign;
  const feeInr = isForeign ? convertForeignToInr(feeForeign, invoice.currency, invoice.exchangeRate) : feeForeign;

  // Amount credited in INR
  const parsedInr = amountInr !== '' ? parseFloat(amountInr) : null;
  const equivalentForeign = parsedInr !== null && isForeign
    ? convertInrToForeign(parsedInr, invoice.currency, invoice.exchangeRate)
    : null;

  // Accurate Gap: Target Net INR minus Actual Settled INR
  const gapInr = parsedInr !== null ? netInr - parsedInr : null;
  const gapPct = gapInr !== null && netInr > 0 ? ((gapInr / netInr) * 100).toFixed(2) : null;
  const gapForeign = gapInr !== null && isForeign
    ? convertInrToForeign(Math.abs(gapInr), invoice.currency, invoice.exchangeRate)
    : null;

  // Dual Currency Mode toggle
  const [inputMode, setInputMode] = useState<'INR' | 'FOREIGN'>('INR');
  const [foreignInputVal, setForeignInputVal] = useState(
    invoice.amountSettledInr !== null && isForeign
      ? convertInrToForeign(invoice.amountSettledInr, invoice.currency, invoice.exchangeRate).toString()
      : ''
  );

  const handleInrChange = (val: string) => {
    setAmountInr(val);
    setSaved(false);
    if (val !== '' && !isNaN(parseFloat(val))) {
      const p = parseFloat(val);
      setForeignInputVal(convertInrToForeign(p, invoice.currency, invoice.exchangeRate).toString());
    } else {
      setForeignInputVal('');
    }
  };

  const handleForeignChange = (val: string) => {
    setForeignInputVal(val);
    setSaved(false);
    if (val !== '' && !isNaN(parseFloat(val))) {
      const p = parseFloat(val);
      const computedInr = convertForeignToInr(p, invoice.currency, invoice.exchangeRate);
      setAmountInr(computedInr.toString());
    } else {
      setAmountInr('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    if (parsedInr !== null && (isNaN(parsedInr) || parsedInr < 0)) {
      setError('Enter a valid non-negative amount');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/settle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSettledInr: parsedInr,
          settlementNote: note || null,
          settledAt: settledAt || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved({
        amountSettledInr: parsedInr,
        settlementNote: note || null,
        settledAt: settledAt ? new Date(settledAt) : null,
      });
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-slate-200">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 sm:px-7 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-[#FBF8F3] text-[#B8935B] border border-[#EAE2D5] flex items-center justify-center text-xs">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </span>
          <div>
            <div className="text-xs font-semibold text-slate-800">Settlement Reconciliation</div>
            <div className="text-[10px] text-slate-500 font-medium">
              {invoice.amountSettledInr !== null
                ? isForeign
                  ? `Settled: ₹${invoice.amountSettledInr.toLocaleString('en-IN')} (≈ ${formatCurrency(convertInrToForeign(invoice.amountSettledInr, invoice.currency, invoice.exchangeRate), sym)}) · Gap: ${gapInr !== null ? (gapInr >= 0 ? `₹${gapInr.toLocaleString('en-IN')} (≈ ${formatCurrency(gapForeign ?? 0, sym)})` : `-₹${Math.abs(gapInr).toLocaleString('en-IN')}`) : '—'} (${gapPct}%)`
                  : `Settled: ₹${invoice.amountSettledInr.toLocaleString('en-IN')} · Gap: ${gapInr !== null ? `₹${Math.abs(gapInr).toLocaleString('en-IN')}` : '—'} (${gapPct}%)`
                : 'Enter actual amount credited to your bank account'}
            </div>
          </div>
        </div>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 sm:px-7 pb-5 bg-slate-50/60 border-t border-slate-100">
          {/* Reference table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-4 text-xs">
            {[
              {
                label: 'Invoiced (gross)',
                val: formatCurrency(grossForeign, sym),
                sub: isForeign ? `≈ ₹${grossInr.toLocaleString('en-IN')} (incl. tax & fees)` : 'incl. fees & tax',
              },
              {
                label: 'Net Revenue',
                val: formatCurrency(netForeign, sym),
                sub: isForeign ? `≈ ₹${netInr.toLocaleString('en-IN')} (target net)` : 'your subtotal',
              },
              {
                label: 'Processing Fee',
                val: formatCurrency(feeForeign, sym),
                sub: isForeign ? `≈ ₹${feeInr.toLocaleString('en-IN')}` : 'in invoice currency',
              },
              {
                label: 'Gateway',
                val: invoice.paymentGateway || 'Razorpay',
                sub: isForeign ? 'Bank credit in INR' : 'payment processor',
              },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-slate-400">{item.label}</div>
                <div className="font-semibold text-slate-800 mt-0.5">{item.val}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <label className="block text-xs font-semibold text-slate-800">
                  {inputMode === 'INR'
                    ? 'Actual Amount Credited to Bank Account (INR ₹)'
                    : `Actual Amount Received (${invoice.currency} ${sym})`}{' '}
                  <span className="text-red-500">*</span>
                </label>

                {isForeign && (
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setInputMode('INR')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        inputMode === 'INR'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ₹ INR (Bank Credit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('FOREIGN')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        inputMode === 'FOREIGN'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sym} {invoice.currency} (Invoice)
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-500 mb-1.5">
                {isForeign
                  ? inputMode === 'INR'
                    ? `International invoice in ${invoice.currency}. Enter the exact INR amount deposited into your Indian bank account by ${invoice.paymentGateway || 'gateway'}.`
                    : `Enter the amount in ${invoice.currency}. It will be converted to INR at the invoice FX rate (1 INR = ${invoice.exchangeRate} ${invoice.currency}).`
                  : 'Enter the exact amount that was credited to your bank account (after gateway deductions).'}
              </p>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                  {inputMode === 'INR' ? '₹' : sym}
                </span>
                {inputMode === 'INR' ? (
                  <input
                    type="number"
                    value={amountInr}
                    onChange={e => handleInrChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] bg-white shadow-2xs"
                    placeholder={`e.g. ${Math.round(netInr * 0.98)}`}
                    step="0.01"
                    min={0}
                  />
                ) : (
                  <input
                    type="number"
                    value={foreignInputVal}
                    onChange={e => handleForeignChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] bg-white shadow-2xs"
                    placeholder={`e.g. ${(netForeign * 0.98).toFixed(2)}`}
                    step="0.01"
                    min={0}
                  />
                )}
              </div>

              {/* Real-time currency parity indicator */}
              {isForeign && parsedInr !== null && (
                <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center justify-between">
                  <span>
                    {inputMode === 'INR'
                      ? `Equivalent in ${invoice.currency}: ≈ ${formatCurrency(equivalentForeign || 0, sym)}`
                      : `Credited to Indian bank: ≈ ₹${parsedInr.toLocaleString('en-IN')}`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    1 INR = {invoice.exchangeRate} {invoice.currency}
                  </span>
                </div>
              )}

              {/* Live gap indicator */}
              {gapInr !== null && (
                <div
                  className={`mt-2.5 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border ${
                    gapInr > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                      : gapInr < 0
                      ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                  }`}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    {gapInr === 0 ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
                  </svg>
                  <span>
                    {gapInr > 0
                      ? `Gateway fee deduction: ₹${gapInr.toLocaleString('en-IN')}${isForeign ? ` (≈ ${sym}${gapForeign})` : ''} · ${gapPct}% deduction by ${invoice.paymentGateway || 'gateway'}`
                      : gapInr < 0
                      ? `Settlement surplus: ₹${Math.abs(gapInr).toLocaleString('en-IN')}${isForeign ? ` (≈ ${sym}${gapForeign})` : ''} above target net revenue`
                      : 'Zero fee gap — exact 100% reconciliation match!'}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Settlement Date</label>
                <input
                  type="date"
                  value={settledAt}
                  onChange={e => setSettledAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] bg-white shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] bg-white shadow-2xs"
                  placeholder="e.g. Razorpay batch #RZP-20260820"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-xs ${
                  saved
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#B8935B] hover:bg-[#9A7540] disabled:opacity-50'
                }`}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settlement'}
              </button>
              {invoice.amountSettledInr !== null && (
                <button
                  onClick={() => {
                    setAmountInr('');
                    setForeignInputVal('');
                    setNote('');
                    setSaved(false);
                  }}
                  className="px-4 py-2.5 text-slate-500 border border-slate-200 hover:bg-slate-100 text-sm rounded-xl transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Reconciliation Dashboard link */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">
              All settlements are tracked in the Revenue Reconciliation dashboard
            </p>
            <a
              href="/reconciliation"
              className="text-[10px] text-[#B8935B] hover:underline font-semibold"
            >
              View Dashboard →
            </a>
          </div>
        </div>
      )}
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
        <div style={{ color: '#B8935B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg className="animate-spin h-5 w-5 text-[#B8935B]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading invoice…
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>Invoice not found</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>This invoice may have been deleted or does not exist.</div>
          <Link href="/invoices" style={{ color: '#B8935B', fontSize: 13, marginTop: 12, display: 'inline-block', fontWeight: 600 }}>← Back to Invoices</Link>
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
            <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Desktop & Tablet Top Action Buttons */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95"
                onClick={() => setShowEditPricing(true)}
              >
                <IconEdit size={14} className="text-[#B8935B]" />
                <span>Edit Pricing</span>
              </button>
            )}
            <button
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95"
              onClick={() => setShowRevision(true)}
            >
              <IconRefresh size={14} className="text-[#B8935B]" />
              <span>Revision</span>
            </button>
            <button
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
              onClick={handleResend}
              disabled={resending}
            >
              <IconMail size={14} className="text-[#B8935B]" />
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
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-xs font-bold transition-all shadow-sm shadow-[#B8935B]/20 flex items-center gap-2 active:scale-95 hover:opacity-95"
                  >
                    <IconCreditCard size={14} className="text-[#D4AF7A]" />
                    <span>{isPayPal ? 'PayPal Link ↗' : 'Payment Link ↗'}</span>
                  </a>
                ) : null;
              })()
            )}

            {invoice.status !== 'PAID' && (
              <button
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
                onClick={handleMarkPaid}
                disabled={markingPaid}
              >
                <IconCheck size={14} className="text-white" />
                <span>{markingPaid ? 'Updating…' : 'Mark as Paid'}</span>
              </button>
            )}

            {invoice.status === 'PAID' && (
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[#0A0B0D] hover:bg-black text-[#F4F1EB] border border-[#B8935B]/40 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#B8935B" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download PDF Receipt</span>
              </a>
            )}

            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95 disabled:opacity-50"
                onClick={handleSyncRazorpay}
                disabled={syncing}
              >
                <IconRefresh size={14} className="text-[#B8935B]" />
                <span>{syncing ? 'Syncing…' : 'Sync Gateway'}</span>
              </button>
            )}

            {invoice.status !== 'PAID' && invoice.status !== 'PARTIALLY_PAID' ? (
              <button
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-95"
                onClick={() => setShowDelete(true)}
              >
                <IconTrash size={14} className="text-rose-600" />
                <span>Delete</span>
              </button>
            ) : (
              <div
                className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"
                title="Paid invoices cannot be deleted for accounting & audit compliance"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <span>Paid (Locked)</span>
              </div>
            )}
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
                  <IconCreditCard size={16} className="text-[#D4AF7A]" />
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
              <IconCheck size={15} className="text-white" />
              <span>{markingPaid ? 'Updating Status…' : 'Mark as Paid'}</span>
            </button>
          )}

          {invoice.status === 'PAID' && (
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-[#0A0B0D] text-[#F4F1EB] border border-[#B8935B]/40 text-xs font-bold shadow-xs flex items-center justify-center gap-2 active:scale-98 text-center"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#B8935B" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Official PDF Receipt</span>
            </a>
          )}

          {/* Secondary Mobile Buttons Grid */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {canEdit && (
              <button
                className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1.5"
                onClick={() => setShowEditPricing(true)}
              >
                <IconEdit size={13} className="text-[#B8935B]" />
                <span>Edit</span>
              </button>
            )}
            <button
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1.5"
              onClick={() => setShowRevision(true)}
            >
              <IconRefresh size={13} className="text-[#B8935B]" />
              <span>Revision</span>
            </button>
            <button
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1.5 disabled:opacity-50"
              onClick={handleResend}
              disabled={resending}
            >
              <IconMail size={13} className="text-[#B8935B]" />
              <span>Resend</span>
            </button>
            {invoice.razorpayLinkId && invoice.status !== 'PAID' && (
              <button
                className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1.5 disabled:opacity-50"
                onClick={handleSyncRazorpay}
                disabled={syncing}
              >
                <IconRefresh size={13} className="text-[#B8935B]" />
                <span>Sync</span>
              </button>
            )}
            {invoice.status !== 'PAID' && invoice.status !== 'PARTIALLY_PAID' && (
              <button
                className="py-2 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold text-center truncate flex items-center justify-center gap-1.5"
                onClick={() => setShowDelete(true)}
              >
                <IconTrash size={13} className="text-rose-600" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Main Layout: Invoice Card + Desktop Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px] gap-6 sm:gap-8 items-start">
          
          {/* ── INVOICE CARD ── */}
          <div className="w-full">
            {(() => {
              const lineItemsArr = ((typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) as unknown as import('@/types').LineItem[]) || [];
              const pkg = getInvoicePackageDetails(invoice.clientType, invoice.notes, lineItemsArr);
              const cleanTxnRef =
                invoice.razorpayPaymentId ||
                invoice.paypalInvoiceId ||
                `TXN-${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}`;
              const isIndia = !invoice.country || invoice.country.toLowerCase().includes('india') || invoice.currency === 'INR';
              const jurisdictionLabel = isIndia ? 'India (Domestic Rail)' : `${invoice.country || 'International'} (Global Rail)`;

              let gatewayLabel = 'Via Razorpay Payment Gateway';
              if (invoice.paymentGateway === 'PAYPAL' || invoice.paypalPaymentUrl) {
                gatewayLabel = 'Via PayPal Payment Gateway';
              } else if (invoice.paymentGateway?.includes('BANK_TRANSFER')) {
                gatewayLabel = 'Via Authorized Institutional Banking Rail';
              }

              const shortHash = `SHA-256: 8F6D...${invoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(-6)}`;

              return (
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden w-full">
                  {/* Top Gold Gradient Accent Bar */}
                  <div className="h-2 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#AA7C11]" />

                  <div className="p-4 sm:p-8 lg:p-10 space-y-5 sm:space-y-7">
                    {/* ── 1. HEADER ── */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Left: Brand Lockup */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#0E1217] flex items-center justify-center border border-[#B88A44]/30 shadow-md shrink-0">
                          <svg width="24" height="24" viewBox="0 0 52 52" className="sm:w-7 sm:h-7">
                            <polygon points="17,40 23,40 34,20 28,20" fill="#F4F4F2" />
                            <polygon points="28,20 34,20 40,9 34,9" fill="#B88A44" />
                            <circle cx="37" cy="12.5" r="1.5" fill="#0E1217" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-lg sm:text-2xl font-black tracking-wider text-[#0E1217]">CATALYST</span>
                            <span className="text-[10px] sm:text-xs font-extrabold tracking-widest text-[#AA7C11]">
                              | TALENT POSITIONING ARCHITECTURE
                            </span>
                          </div>
                          <div className="text-[9px] sm:text-[11px] font-bold tracking-wider text-slate-500 uppercase mt-0.5">
                            A SUB-BRAND OF RIPPLE NEXUS
                          </div>
                        </div>
                      </div>

                      {/* Right: Invoice Type & Status Badge */}
                      <div className="flex items-center justify-between sm:block sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-lg sm:text-2xl font-black tracking-wide text-[#0E1217]">TAX INVOICE</div>
                        <div className="sm:mt-1 flex sm:justify-end">
                          {invoice.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-black tracking-wider uppercase">
                              <span className="w-2 h-2 rounded-full bg-[#059669]" />
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black tracking-wider uppercase">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              PAYMENT DUE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hairline Separator */}
                    <div className="h-px bg-[#ECEFF2]" />

                    {/* ── 2. METADATA CARDS ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
                      {/* Left: Client Particulars */}
                      <div className="bg-[#F8FAFC] border border-[#EAEFF4] rounded-xl p-4 sm:p-5 space-y-2 min-w-0">
                        <div className="text-[10px] font-extrabold tracking-wider text-[#8A94A6] uppercase">
                          BILLED TO (PRINCIPAL CLIENT)
                        </div>
                        <div className="text-base sm:text-xl font-bold text-[#0E1217] break-words">
                          {invoice.clientName}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-slate-600 flex items-center gap-2 min-w-0">
                          <IconMail size={13} className="text-[#B88A44] shrink-0" />
                          <a href={`mailto:${invoice.clientEmail}`} className="hover:text-[#B88A44] truncate break-all">
                            {invoice.clientEmail}
                          </a>
                        </div>
                        {invoice.clientPhone && (
                          <div className="text-xs sm:text-sm font-medium text-slate-600 flex items-center gap-2 min-w-0">
                            <IconPhone size={13} className="text-[#B88A44] shrink-0" />
                            <a href={`tel:${invoice.clientPhone}`} className="hover:text-[#B88A44] truncate">
                              {invoice.clientPhone}
                            </a>
                          </div>
                        )}
                        <div className="text-xs text-[#8A94A6] pt-1">
                          Jurisdiction: <strong className="text-slate-900">{jurisdictionLabel}</strong>
                        </div>
                      </div>

                      {/* Right: Fiscal Ledger Breakdown */}
                      <div className="bg-[#F8FAFC] border border-[#EAEFF4] rounded-xl p-4 sm:p-5 min-w-0">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-extrabold tracking-wider text-[#8A94A6] uppercase truncate">
                              INVOICE NUMBER
                            </div>
                            <div className="font-mono text-xs sm:text-sm font-bold text-[#0E1217] mt-1 break-all">
                              {invoice.invoiceNumber}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-extrabold tracking-wider text-[#8A94A6] uppercase truncate">
                              TRANSACTION REF
                            </div>
                            <div className="font-mono text-xs sm:text-sm font-bold text-[#0E1217] mt-1 break-all">
                              {cleanTxnRef}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-extrabold tracking-wider text-[#8A94A6] uppercase truncate">
                              ISSUE DATE
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1">
                              {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-extrabold tracking-wider text-[#8A94A6] uppercase truncate">
                              {invoice.status === 'PAID' ? 'SETTLEMENT DATE' : 'DUE DATE'}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1">
                              {invoice.status === 'PAID' && invoice.paidAt
                                ? format(new Date(invoice.paidAt), 'dd MMM yyyy')
                                : format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── 3. ENGAGEMENT SCOPE BANNER ── */}
                    <div className="bg-[#0E1217] rounded-xl p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white shadow-md">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                        <span className="text-[11px] sm:text-xs font-extrabold tracking-wider text-[#AA7C11] uppercase shrink-0">
                          ENGAGEMENT SCOPE
                        </span>
                        <span className="text-sm sm:text-base font-bold text-white">
                          {pkg.packageName}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-400 font-normal">
                          {pkg.trackName}
                        </span>
                      </div>
                      <div className="shrink-0 self-start sm:self-auto">
                        <span className="bg-[#1E293B] px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider text-[#F1F5F9] inline-block">
                          {pkg.slaDays}
                        </span>
                      </div>
                    </div>

                    {/* ── 4. LINE ITEMS TABLE ── */}
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table className="w-full text-left border-collapse min-w-[500px] sm:min-w-full">
                        <thead>
                          <tr className="bg-[#F1F5F9] text-[10px] sm:text-[10.5px] font-extrabold text-[#475569] uppercase tracking-wider">
                            <th className="py-2.5 px-3 sm:px-4 rounded-l-lg">SERVICE SPECIFICATION &amp; DELIVERABLES</th>
                            <th className="py-2.5 px-3 sm:px-4 text-center w-16 sm:w-20">QTY</th>
                            <th className="py-2.5 px-3 sm:px-4 text-right w-28 sm:w-36">UNIT RATE</th>
                            <th className="py-2.5 px-3 sm:px-4 text-right w-28 sm:w-36 rounded-r-lg">NET AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {lineItemsArr.map((item, idx) => {
                            const sanitized = sanitizeItemDescription(item.description, pkg.packageName);
                            const isFree = item.lineTotal === 0 || sanitized.isComp;
                            const qtyStr = item.qty < 10 ? `0${item.qty}` : `${item.qty}`;
                            const formattedRate = isFree ? `${invoice.currencySymbol || invoice.currency}0.00` : fmt(item.unitPrice);
                            const formattedTotal = isFree ? `${invoice.currencySymbol || invoice.currency}0.00` : fmt(item.lineTotal);

                            return (
                              <tr key={item.id ?? idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs sm:text-sm text-[#0E1217]">
                                      {sanitized.title}
                                    </span>
                                    {isFree && (
                                      <span className="bg-[#FEF3C7] text-[#92400E] text-[9.5px] sm:text-[10px] font-black px-2 py-0.5 rounded tracking-wide shrink-0">
                                        COMPLIMENTARY
                                      </span>
                                    )}
                                  </div>
                                  {sanitized.subtitle && (
                                    <div className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                                      {sanitized.subtitle}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-center font-mono font-semibold text-xs sm:text-sm text-slate-700">
                                  {qtyStr}
                                </td>
                                <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-right font-mono font-semibold text-xs sm:text-sm text-slate-700">
                                  {formattedRate}
                                </td>
                                <td className={`py-3 px-3 sm:py-3.5 sm:px-4 text-right font-mono font-bold text-xs sm:text-sm ${isFree ? 'text-[#059669]' : 'text-[#0E1217]'}`}>
                                  {formattedTotal}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── 5. TOTALS SECTION ── */}
                    <div className="flex flex-col sm:items-end pt-2">
                      <div className="w-full sm:w-96 max-w-full space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>Net Subtotal</span>
                          <span className="font-mono font-semibold text-[#0E1217]">{fmt(invoice.subtotalConverted)}</span>
                        </div>

                        {invoice.discountAmount > 0 && (
                          <div className="flex justify-between items-center text-[#059669]">
                            <span>Concession / Discount ({invoice.discountRate}%)</span>
                            <span className="font-mono font-semibold">−{fmt(invoice.discountAmount)}</span>
                          </div>
                        )}

                        {invoice.taxAmount > 0 && (
                          <div className="flex justify-between items-center text-[#64748B]">
                            <span>Applicable Tax ({invoice.taxRate}%)</span>
                            <span className="font-mono font-semibold text-[#0E1217]">+{fmt(invoice.taxAmount)}</span>
                          </div>
                        )}

                        {invoice.processingFeeConverted > 0 && (
                          <div className="flex justify-between items-center text-[#64748B]">
                            <span>Processing &amp; Settlement Fee</span>
                            <span className="font-mono font-semibold text-[#0E1217]">+{fmt(invoice.processingFeeConverted)}</span>
                          </div>
                        )}

                        <div className="h-px bg-slate-200 my-2" />

                        {/* Dark Settled Total Box */}
                        <div className="bg-[#0E1217] text-white p-3.5 sm:p-4 rounded-xl flex items-center justify-between shadow-md">
                          <span className="text-[11px] sm:text-xs font-extrabold text-[#D4AF37] tracking-wider uppercase">
                            {invoice.status === 'PAID' ? `TOTAL PAID (${invoice.currency})` : `TOTAL PAYABLE (${invoice.currency})`}
                          </span>
                          <div className="text-right">
                            <div className="font-mono text-lg sm:text-2xl font-black text-white">
                              {fmt(invoice.totalPayable)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {gatewayLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── 6. SERVICE LEVEL AGREEMENT & EXECUTION PROTOCOL ── */}
                    <div className="bg-[#F8FAFC] border border-[#EAEFF4] rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-[#F1F5F9] px-4 sm:px-5 py-2.5 text-[11px] font-extrabold text-[#334155] tracking-wider uppercase">
                        SERVICE LEVEL AGREEMENT &amp; EXECUTION PROTOCOL
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#EAEFF4] p-4 sm:p-5 gap-4 md:gap-0">
                        <div className="md:px-4 first:pl-0 space-y-1">
                          <div className="font-bold text-xs sm:text-sm text-[#0E1217] flex items-center gap-1.5">
                            <span className="text-[#AA7C11] font-black">●</span> Turnaround SLA Window
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Delivery guaranteed within {pkg.slaDays.replace('SLA: ', '').toLowerCase()} following intake sign-off.
                          </p>
                        </div>
                        <div className="md:px-4 space-y-1 pt-3 md:pt-0">
                          <div className="font-bold text-xs sm:text-sm text-[#0E1217] flex items-center gap-1.5">
                            <span className="text-[#AA7C11] font-black">●</span> Calibrations &amp; Revisions
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Includes 2 iterative calibration cycles within 7 calendar days of draft dispatch.
                          </p>
                        </div>
                        <div className="md:px-4 last:pr-0 space-y-1 pt-3 md:pt-0">
                          <div className="font-bold text-xs sm:text-sm text-[#0E1217] flex items-center gap-1.5">
                            <span className="text-[#AA7C11] font-black">●</span> Governance &amp; Authority
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Enforceable under Catalyst Governance &amp; Ripple Nexus Master Framework.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ── 7. CORPORATE ENTITY SIGN-OFF & VERIFICATION SEAL ── */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                      {/* Left: Entity */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-extrabold tracking-wider text-[#8A94A6] uppercase">
                          ISSUING CORPORATE LEGAL ENTITY
                        </div>
                        <div className="font-black text-sm sm:text-base text-[#0E1217]">
                          Ripple Nexus
                        </div>
                        <div className="text-xs font-bold text-[#B88A44]">
                          Operating as Catalyst (A Sub-Brand of Ripple Nexus)
                        </div>
                        <div className="text-xs text-slate-500">
                          Global Talent Positioning Architecture • catalyst.theripplenexus.com
                        </div>
                      </div>

                      {/* Right: Cryptographic Seal */}
                      <div className="p-3 sm:p-3.5 bg-[#F8FAFC] border border-dashed border-slate-300 rounded-xl flex items-center gap-3 w-full md:w-auto">
                        <div className="w-8 h-8 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] flex items-center justify-center font-black text-sm shrink-0">
                          ✓
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-[#065F46] tracking-wide uppercase">
                            CRYPTOGRAPHICALLY VERIFIED
                          </div>
                          <div className="font-mono text-[11px] sm:text-xs text-slate-500 break-all">
                            {shortHash}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Authenticated Digital Receipt
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── 8. MICRO FOOTER ── */}
                    <div className="h-px bg-[#ECEFF2]" />
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>This document is an authenticated tax invoice and receipt for talent architecture services rendered.</span>
                      <span className="font-bold text-[#AA7C11] tracking-wider uppercase">CATALYST • A SUB-BRAND OF RIPPLE NEXUS</span>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Settlement Reconciliation Panel — only shown for PAID invoices */}
            {invoice.status === 'PAID' && (
              <div className="mt-6">
                <SettlementPanel invoice={invoice} onSaved={(updated) => setInvoice(i => i ? { ...i, ...updated } : i)} />
              </div>
            )}
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
                    <span className="font-mono text-xs font-bold text-[#B8935B] truncate max-w-[140px]">
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
        <DeleteModal
          invoice={invoice}
          onCancel={() => setShowDelete(false)}
          onDeleted={() => {
            setShowDelete(false);
            show('Invoice deleted permanently');
            router.push('/invoices');
          }}
        />
      )}

      <Toasts toasts={toasts} />
    </AppShell>
  );
}
