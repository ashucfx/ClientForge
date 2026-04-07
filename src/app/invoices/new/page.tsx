'use client';
// src/app/invoices/new/page.tsx

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COUNTRIES } from '@/lib/currency';
import { CLIENT_TYPE_LABELS, formatCurrency } from '@/lib/pricing';
import type { ClientType, PricingCalculation, CurrencyInfo } from '@/types';

const CLIENT_TYPES: ClientType[] = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'];

// ─────────────────────────────────────────────
// RADIO CARD
// ─────────────────────────────────────────────
function RadioCard({
  value, selected, onSelect, label, sub,
}: {
  value: string; selected: boolean; onSelect: (v: string) => void; label: string; sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      style={{
        borderColor: selected ? '#1f56d4' : '#e8eeff',
        background: selected ? '#e8f0fe' : '#fff',
        transition: 'all 0.15s',
      }}
      className="w-full text-left p-3.5 rounded-xl border-2 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: `2px solid ${selected ? '#1f56d4' : '#d1d5db'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1f56d4' }} />}
        </div>
        <div>
          <div className="font-semibold text-sm" style={{ color: selected ? '#1f56d4' : '#0f1c3d' }}>{label}</div>
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// PRICING PREVIEW
// ─────────────────────────────────────────────
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
      <div style={{ background: '#f8faff', borderColor: '#e8eeff' }} className="rounded-2xl border p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    );
  }
  if (!pricing) return null;

  const fmt = (n: number) => formatCurrency(n, sym);

  return (
    <div style={{ borderColor: '#e8eeff' }} className="rounded-2xl border overflow-hidden">
      <div style={{ background: '#1f56d4' }} className="px-5 py-3">
        <div className="text-xs text-white/70 uppercase tracking-widest font-semibold">Live Pricing Preview</div>
        <div className="text-white text-xs mt-0.5">Currency: {currency}</div>
      </div>
      <div className="p-5 space-y-2.5 bg-white">
        {pricing.resumeConverted > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Resume Writing</span>
            <span className="font-semibold" style={{ color: '#0f1c3d' }}>{fmt(pricing.resumeConverted)}</span>
          </div>
        )}
        {pricing.linkedinConverted > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">LinkedIn Optimization</span>
            <span className="font-semibold" style={{ color: '#0f1c3d' }}>{fmt(pricing.linkedinConverted)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cover Letter</span>
          <span className="font-semibold" style={{ color: '#3FBD8B' }}>FREE</span>
        </div>
        <div style={{ borderTop: '1px solid #f0f4ff' }} className="pt-2.5 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-700">{fmt(pricing.subtotalConverted)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Processing Fee ({(pricing.processingFeeRate * 100).toFixed(1)}%)</span>
            <span className="text-gray-700">{fmt(pricing.processingFeeConverted)}</span>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#1f56d4,#1a42a0)', borderRadius: 10 }} className="flex justify-between items-center p-3.5 mt-1">
          <span className="text-white/80 text-sm font-semibold">Total Payable</span>
          <span className="text-white text-xl font-extrabold">{fmt(pricing.totalPayable)}</span>
        </div>
        <div className="text-xs text-gray-400 text-center pt-1">
          Exchange rate: 1 INR = {pricing.exchangeRate.toFixed(5)} {currency}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FORM FIELD
// ─────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        {label} {required && <span style={{ color: '#1f56d4' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-blue-400 transition-colors";
const inputStyle = { borderColor: '#e8eeff', background: '#fff', color: '#0f1c3d' };

// ─────────────────────────────────────────────
// MAIN FORM
// ─────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = client info, 2 = services

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [country, setCountry] = useState('');
  const [clientType, setClientType] = useState<ClientType>('FRESHER');
  const [services, setServices] = useState({ resume: true, linkedin: true, coverLetter: true });
  const [currencyOverride, setCurrencyOverride] = useState('');

  // Pricing state
  const [pricing, setPricing] = useState<PricingCalculation | null>(null);
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch live pricing whenever key fields change
  const fetchPricing = useCallback(async () => {
    if (!country && !currencyOverride) return;
    setPricingLoading(true);
    try {
      const servicesList = Object.entries(services).filter(([, v]) => v).map(([k]) => k).join(',');
      const params = new URLSearchParams({
        country,
        clientType,
        services: servicesList,
      });
      if (currencyOverride) params.set('currency', currencyOverride);

      const res = await fetch(`/api/currency?${params}`);
      const data = await res.json();
      setPricing(data.pricing);
      setCurrencyInfo(data.currency);
    } catch {
      // silent
    } finally {
      setPricingLoading(false);
    }
  }, [country, clientType, services, currencyOverride]);

  useEffect(() => {
    const t = setTimeout(fetchPricing, 400);
    return () => clearTimeout(t);
  }, [fetchPricing]);

  const handleSubmit = async () => {
    if (!clientName || !clientEmail || !clientPhone || !country) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!services.resume && !services.linkedin) {
      setError('Please select at least one paid service.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientPhone,
          country,
          clientType,
          currencyOverride: currencyOverride || undefined,
          services,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Creation failed');
      }

      const { invoice } = await res.json();
      router.push(`/invoices/${invoice.id}?created=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  const sym = currencyInfo?.symbol ?? '$';
  const currency = currencyInfo?.code ?? 'USD';

  return (
    <div className="min-h-screen" style={{ background: '#f0f4ff' }}>
      <div className="flex">
        {/* SIDEBAR */}
        <aside style={{ background: '#0f1c3d', minHeight: '100vh' }} className="w-60 flex-shrink-0 fixed left-0 top-0 bottom-0">
          <div className="px-6 py-6 border-b border-white/10">
            <Link href="/" className="text-2xl font-extrabold text-white tracking-tight">
              Ripple<span style={{ color: '#3FBD8B' }}>Nexus</span>
            </Link>
            <div className="text-xs text-white/40 mt-0.5">Invoice System</div>
          </div>
          <nav className="px-3 py-4 space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <span>📊</span> Dashboard
            </Link>
            <a href="/invoices/new" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'rgba(31,86,212,0.3)' }}>
              <span>➕</span> New Invoice
            </a>
          </nav>
        </aside>

        {/* MAIN */}
        <main className="ml-60 flex-1 p-8 animate-page">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">← Back</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-extrabold" style={{ color: '#0f1c3d' }}>Create New Invoice</h1>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* LEFT COLUMN — FORM */}
            <div className="col-span-2 space-y-5">
              {/* SECTION 1: Client Details */}
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div style={{ background: '#1f56d4', width: 28, height: 28 }} className="rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <h2 className="font-bold text-base" style={{ color: '#0f1c3d' }}>Client Information</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Full Name" required>
                      <input
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <Field label="Email Address" required>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={e => setClientEmail(e.target.value)}
                      placeholder="priya@example.com"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Phone Number" required>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Country" required>
                      <select
                        value={country}
                        onChange={e => { setCountry(e.target.value); setCurrencyOverride(''); }}
                        className={inputClass}
                        style={inputStyle}
                      >
                        <option value="">Select country...</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                  {country && (
                    <div className="col-span-2">
                      <Field label="Currency Override (optional)">
                        <input
                          type="text"
                          value={currencyOverride}
                          onChange={e => setCurrencyOverride(e.target.value.toUpperCase())}
                          placeholder={`Auto-detected: ${currencyInfo?.code ?? '...'} — Override e.g. USD`}
                          className={inputClass}
                          style={inputStyle}
                          maxLength={3}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Client Type */}
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div style={{ background: '#1f56d4', width: 28, height: 28 }} className="rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <h2 className="font-bold text-base" style={{ color: '#0f1c3d' }}>Client Type</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {CLIENT_TYPES.map(t => (
                    <RadioCard
                      key={t}
                      value={t}
                      selected={clientType === t}
                      onSelect={v => setClientType(v as ClientType)}
                      label={CLIENT_TYPE_LABELS[t]}
                      sub={
                        t === 'FRESHER' ? 'Entry-level & graduates' :
                        t === 'MID_CAREER' ? '3–10 years experience' :
                        t === 'EXECUTIVE' ? '10+ years, leadership roles' :
                        'C-Suite & Board level'
                      }
                    />
                  ))}
                </div>
              </div>

              {/* SECTION 3: Services */}
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div style={{ background: '#1f56d4', width: 28, height: 28 }} className="rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <h2 className="font-bold text-base" style={{ color: '#0f1c3d' }}>Services</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'resume', label: 'Professional Resume Writing', icon: '📄', free: false },
                    { key: 'linkedin', label: 'LinkedIn Profile Optimization', icon: '🔗', free: false },
                    { key: 'coverLetter', label: 'Cover Letter Template', icon: '✉️', free: true },
                  ].map(({ key, label, icon, free }) => (
                    <label
                      key={key}
                      style={{
                        borderColor: services[key as keyof typeof services] ? '#1f56d4' : '#e8eeff',
                        background: services[key as keyof typeof services] ? '#e8f0fe' : '#fff',
                        cursor: free ? 'default' : 'pointer',
                      }}
                      className="flex items-center justify-between p-4 rounded-xl border-2 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={services[key as keyof typeof services]}
                          disabled={free}
                          onChange={e => setServices(s => ({ ...s, [key]: e.target.checked }))}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-lg">{icon}</span>
                        <span className="text-sm font-semibold" style={{ color: '#0f1c3d' }}>{label}</span>
                      </div>
                      {free ? (
                        <span style={{ color: '#3FBD8B', background: '#e6f9f1' }} className="text-xs font-bold px-2.5 py-1 rounded-full">FREE</span>
                      ) : pricing && (
                        <span className="text-sm font-bold" style={{ color: '#1f56d4' }}>
                          {formatCurrency(
                            key === 'resume' ? pricing.resumeConverted : pricing.linkedinConverted,
                            sym
                          )}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' }} className="border rounded-xl px-4 py-3 text-sm">
                  ⚠️ {error}
                </div>
              )}

              {/* SUBMIT */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ background: submitting ? '#9ca3af' : '#1f56d4' }}
                className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg hover:opacity-90 transition-all disabled:cursor-not-allowed"
              >
                {submitting ? '⏳ Creating Invoice...' : '🚀 Create Invoice & Send Email'}
              </button>
            </div>

            {/* RIGHT COLUMN — PRICING PREVIEW */}
            <div className="space-y-4">
              <div style={{ borderColor: '#e8eeff' }} className="bg-white rounded-2xl border p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">What happens next?</div>
                <div className="space-y-3">
                  {[
                    ['📄', 'Invoice generated with unique number'],
                    ['🔗', 'Razorpay payment link created'],
                    ['📧', 'Branded email sent to client'],
                    ['💳', 'Client pays via secure link'],
                    ['✅', 'Status auto-updates on payment'],
                  ].map(([icon, text], i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5">{icon}</span>
                      <span className="text-xs text-gray-500 leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <PricingPreview
                pricing={pricing}
                currency={currency}
                sym={sym}
                loading={pricingLoading}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
