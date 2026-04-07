'use client';
// src/app/invoices/new/page.tsx

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COUNTRIES } from '@/lib/currency';
import { CLIENT_TYPE_LABELS, BASE_PRICING, formatCurrency } from '@/lib/pricing';
import type { ClientType, PricingCalculation, CurrencyInfo } from '@/types';
import { LogoSidebar } from '@/components/Logo';

const CLIENT_TYPES: ClientType[] = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'];

const CLIENT_META: Record<ClientType, { icon: string; sub: string; color: string }> = {
  FRESHER:        { icon: '🎓', sub: 'Entry-level & recent graduates', color: '#6366f1' },
  MID_CAREER:     { icon: '💼', sub: '3–10 years experience',          color: '#ec4899' },
  EXECUTIVE:      { icon: '🏢', sub: '10+ yrs · leadership roles',    color: '#f59e0b' },
  EXECUTIVE_PLUS: { icon: '👑', sub: 'C-Suite & Board level',          color: '#1f56d4' },
};

// ─── Nav link ─────────────────────────────────
function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{ color: active ? '#fff' : 'rgba(255,255,255,0.6)', background: active ? 'rgba(31,86,212,0.35)' : 'transparent' }}
    >
      <span className="text-base w-5 text-center">{icon}</span>{label}
    </Link>
  );
}

// ─── Step indicator ────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--border)',
        color: done || active ? '#fff' : 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
        transition: 'all .2s',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
    </div>
  );
}

// ─── Section card ──────────────────────────────
function SectionCard({ n, label, icon, children }: { n: number; label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{n}</span>
        </div>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>{label}</h2>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 20 }}>{icon}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Field label ───────────────────────────────
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
      {label} {required && <span style={{ color: 'var(--blue)' }}>*</span>}
    </label>
  );
}

// ─── Pricing preview ───────────────────────────
function PricingPreview({
  pricing, currency, sym, loading,
}: {
  pricing: PricingCalculation | null;
  currency: string;
  sym: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card p-5">
        <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, width: '60%', marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 10, background: '#f1f5f9', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite', width: `${70 - i * 10}%` }} />
        ))}
      </div>
    );
  }
  if (!pricing) return null;

  const fmt = (n: number) => formatCurrency(n, sym);

  return (
    <div className="card overflow-hidden">
      <div style={{ background: 'linear-gradient(135deg,#0f1c3d,#1f56d4)', padding: '14px 18px' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>
          Live Pricing Preview
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{currency}</div>
      </div>
      <div style={{ padding: '16px 18px', background: '#fff' }}>
        <div className="space-y-2">
          {pricing.resumeConverted > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted)' }}>📄 Resume Writing</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(pricing.resumeConverted)}</span>
            </div>
          )}
          {pricing.linkedinConverted > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--muted)' }}>🔗 LinkedIn</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(pricing.linkedinConverted)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--muted)' }}>✉️ Cover Letter</span>
            <span style={{ fontWeight: 700, color: 'var(--green)' }}>FREE</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
            <div className="flex justify-between text-sm mb-1.5" style={{ color: 'var(--muted)' }}>
              <span>Subtotal</span><span>{fmt(pricing.subtotalConverted)}</span>
            </div>
            <div className="flex justify-between text-sm mb-3" style={{ color: 'var(--muted)' }}>
              <span>Processing Fee ({(pricing.processingFeeRate * 100).toFixed(1)}%)</span>
              <span>{fmt(pricing.processingFeeConverted)}</span>
            </div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#1f56d4,#1a42a0)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>Total Payable</span>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{fmt(pricing.totalPayable)}</span>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
          1 INR = {pricing.exchangeRate.toFixed(5)} {currency}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN FORM
// ─────────────────────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();

  const [clientName,  setClientName]  = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [country,     setCountry]     = useState('');
  const [clientType,  setClientType]  = useState<ClientType>('FRESHER');
  const [services,    setServices]    = useState({ resume: true, linkedin: true, coverLetter: true });
  const [currencyOverride, setCurrencyOverride] = useState('');

  const [pricing,      setPricing]      = useState<PricingCalculation | null>(null);
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const fetchPricing = useCallback(async () => {
    if (!country && !currencyOverride) return;
    setPricingLoading(true);
    try {
      const servicesList = Object.entries(services).filter(([, v]) => v).map(([k]) => k).join(',');
      const p = new URLSearchParams({ country, clientType, services: servicesList });
      if (currencyOverride) p.set('currency', currencyOverride);
      const res  = await fetch(`/api/currency?${p}`);
      const data = await res.json();
      setPricing(data.pricing);
      setCurrencyInfo(data.currency);
    } catch { /* silent */ }
    finally { setPricingLoading(false); }
  }, [country, clientType, services, currencyOverride]);

  useEffect(() => {
    const t = setTimeout(fetchPricing, 350);
    return () => clearTimeout(t);
  }, [fetchPricing]);

  const handleSubmit = async () => {
    if (!clientName || !clientEmail || !clientPhone || !country) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!services.resume && !services.linkedin) {
      setError('Select at least one paid service.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientName, clientEmail, clientPhone, country, clientType, currencyOverride: currencyOverride || undefined, services }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Creation failed'); }
      const { invoice } = await res.json();
      router.push(`/invoices/${invoice.id}?created=true`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  const sym      = currencyInfo?.symbol ?? '₹';
  const currency = currencyInfo?.code   ?? 'INR';
  const defaults = BASE_PRICING[clientType];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="px-5 py-5 border-b border-white/10">
          <LogoSidebar size={34} />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/"             icon="⬛" label="Dashboard" />
          <NavLink href="/invoices/new" icon="＋" label="New Invoice" active />
          <NavLink href="/invoices"     icon="📄" label="All Invoices" />
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>v2.0.0 · Internal</div>
        </div>
      </aside>

      <main className="main-content animate-page">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← Dashboard</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Create New Invoice</h1>
        </div>

        {/* Progress steps */}
        <div className="card p-4 mb-6 flex items-center gap-6">
          <StepBadge n={1} label="Client Info"   active={true}  done={!!(clientName && clientEmail && clientPhone && country)} />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <StepBadge n={2} label="Package"       active={true}  done={!!clientType} />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <StepBadge n={3} label="Services"      active={true}  done={services.resume || services.linkedin} />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <StepBadge n={4} label="Send Invoice"  active={false} done={false} />
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 310px' }}>
          {/* Left — Form */}
          <div className="space-y-5">
            {/* Section 1: Client Info */}
            <SectionCard n={1} label="Client Information" icon="👤">
              <div className="grid grid-cols-2 gap-4">
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label="Full Name" required />
                  <input className="input" type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Priya Sharma" />
                </div>
                <div>
                  <FieldLabel label="Email Address" required />
                  <input className="input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="priya@example.com" />
                </div>
                <div>
                  <FieldLabel label="Phone Number" required />
                  <input className="input" type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 9876543210" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label="Country" required />
                  <select className="input" value={country} onChange={e => { setCountry(e.target.value); setCurrencyOverride(''); }}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {country && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <FieldLabel label="Currency Override (optional)" />
                    <input
                      className="input"
                      type="text"
                      value={currencyOverride}
                      onChange={e => setCurrencyOverride(e.target.value.toUpperCase())}
                      placeholder={`Auto-detected: ${currencyInfo?.code ?? '…'} — Override e.g. USD`}
                      maxLength={3}
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Section 2: Client Type */}
            <SectionCard n={2} label="Career Level" icon="🎯">
              <div className="grid grid-cols-2 gap-3">
                {CLIENT_TYPES.map(t => {
                  const meta = CLIENT_META[t];
                  const sel  = clientType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setClientType(t)}
                      style={{
                        border: `2px solid ${sel ? meta.color : 'var(--border)'}`,
                        background: sel ? `${meta.color}10` : '#fff',
                        borderRadius: 12,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{meta.icon}</span>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? meta.color : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: sel ? meta.color : 'var(--text)' }}>{CLIENT_TYPE_LABELS[t]}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{meta.sub}</div>
                      <div style={{ fontSize: 12, color: meta.color, fontWeight: 600, marginTop: 6 }}>
                        from ₹{defaults.resume + defaults.linkedin}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Section 3: Services */}
            <SectionCard n={3} label="Services" icon="⚙️">
              <div className="space-y-3">
                {[
                  { key: 'resume',      label: 'Professional Resume Writing',   icon: '📄', free: false },
                  { key: 'linkedin',    label: 'LinkedIn Profile Optimization', icon: '🔗', free: false },
                  { key: 'coverLetter', label: 'Cover Letter Template',         icon: '✉️', free: true  },
                ].map(({ key, label, icon, free }) => {
                  const checked = services[key as keyof typeof services];
                  const price   = key === 'resume' ? pricing?.resumeConverted : pricing?.linkedinConverted;
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 12,
                        border: `2px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
                        background: checked ? 'var(--blue-light)' : '#fff',
                        cursor: free ? 'default' : 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={free}
                          onChange={e => setServices(s => ({ ...s, [key]: e.target.checked }))}
                          style={{ width: 16, height: 16, accentColor: 'var(--blue)' }}
                        />
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{label}</div>
                          {!free && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                              Base: ₹{key === 'resume' ? defaults.resume : defaults.linkedin}
                            </div>
                          )}
                        </div>
                      </div>
                      {free ? (
                        <span style={{ background: 'var(--green-light)', color: '#15803d', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          FREE
                        </span>
                      ) : (price && checked) ? (
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}>
                          {formatCurrency(price, sym)}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </SectionCard>

            {/* Error */}
            {error && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 12, padding: '12px 16px', fontSize: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary w-full"
              style={{ padding: '14px', fontSize: 15, justifyContent: 'center' }}
            >
              {submitting ? '⏳ Creating Invoice…' : '🚀 Create Invoice & Send Email'}
            </button>
          </div>

          {/* Right — Sidebar */}
          <div className="space-y-4">
            {/* What happens next */}
            <div className="card p-5">
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 14 }}>What Happens Next</div>
              <div className="space-y-3.5">
                {[
                  ['📄', 'Invoice generated with unique #'],
                  ['🔗', 'Razorpay payment link created'],
                  ['📧', 'Branded email sent to client'],
                  ['💳', 'Client pays via secure link'],
                  ['✅', 'Status auto-updates on payment'],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing preview */}
            <PricingPreview pricing={pricing} currency={currency} sym={sym} loading={pricingLoading} />

            {/* Pricing note */}
            <div style={{ background: 'var(--blue-light)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--blue)', lineHeight: 1.6 }}>
              💡 <strong>Intelligent Pricing:</strong> Base prices in INR are auto-converted to the client&apos;s currency at live exchange rates.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
