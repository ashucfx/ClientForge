'use client';
// src/app/invoices/new/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COUNTRIES } from '@/lib/currency';
import { CLIENT_TYPE_LABELS, BASE_PRICING, FEE_RATES, round2 } from '@/lib/pricing';
import { getCallingCodeForCountryName, normalizePhoneE164 } from '@/lib/phone';
import type { ClientType, LineItem, CurrencyInfo } from '@/types';
import { Logo } from '@/components/Logo';
import { IconAlert, IconCheck, IconCreditCard, IconLink, IconList, IconMail, IconSettings, IconSpinner, IconTarget, IconUser } from '@/components/Icons';
import AppShell from '@/components/AppShell';
import { format, addDays } from 'date-fns';

const CLIENT_TYPES: ClientType[] = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'];

const CLIENT_META: Record<ClientType, { sub: string; color: string }> = {
  FRESHER:        { sub: 'Entry-level & graduates',  color: '#6366f1' },
  MID_CAREER:     { sub: '3–10 years experience',    color: '#ec4899' },
  EXECUTIVE:      { sub: '10+ yrs · Leadership',     color: '#f59e0b' },
  EXECUTIVE_PLUS: { sub: 'C-Suite & Board level',    color: '#1f56d4' },
};

// ─── Helpers ───────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function makeItem(description = '', qty = 1, unitPrice = 0): LineItem {
  return { id: uid(), description, qty, unitPrice, lineTotal: round2(qty * unitPrice) };
}

function defaultItemsForType(clientType: ClientType, exchangeRate: number): LineItem[] {
  const base = BASE_PRICING[clientType];
  const toConverted = (inr: number) => round2(inr / exchangeRate);
  return [
    makeItem('Professional Resume Writing',   1, toConverted(base.resume)),
    makeItem('LinkedIn Profile Optimization', 1, toConverted(base.linkedin)),
    makeItem('Cover Letter Template',         1, 0),
  ];
}

// ─── Sub-components ────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--blue)', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children, noPad }: { title: string; icon: React.ReactNode; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
          {icon}
        </span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>{children}</div>
    </div>
  );
}

// ─── Live Invoice Preview ──────────────────────
function InvoicePreview({
  clientName, clientEmail, clientType, country, companyName,
  lineItems, discountRate, taxRate, notes, dueDays,
  currencyInfo, exchangeRate,
}: {
  clientName: string; clientEmail: string; clientType: ClientType;
  country: string; companyName: string;
  lineItems: LineItem[]; discountRate: number; taxRate: number;
  notes: string; dueDays: number;
  currencyInfo: CurrencyInfo | null; exchangeRate: number;
}) {
  const sym  = currencyInfo?.symbol ?? '₹';
  const code = currencyInfo?.code   ?? 'INR';

  const grossSubtotal   = round2(lineItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0));
  const discountAmount  = round2(grossSubtotal * discountRate / 100);
  const afterDiscount   = round2(grossSubtotal - discountAmount);
  const taxAmount       = round2(afterDiscount * taxRate / 100);
  const subtotal        = round2(afterDiscount + taxAmount);
  const feeRate         = code === 'INR' ? FEE_RATES.INR : FEE_RATES.INTERNATIONAL;
  const fee             = round2(subtotal * feeRate);
  const total           = round2(subtotal + fee);
  const today           = new Date();
  const due             = addDays(today, dueDays);

  return (
    <div className="preview-card" style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', fontSize: 13 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0f1c3d 0%,#1f3a80 60%,#1f56d4 100%)', padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Logo size={28} variant="horizontal" dark />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Invoice</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginTop: 2 }}>PREVIEW</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
              {format(today, 'MMM dd, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Client info */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{clientName || '—'}</div>
            {companyName && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{companyName}</div>}
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{clientEmail || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{country || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 }}>Details</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {CLIENT_TYPE_LABELS[clientType]}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Due: {format(due, 'MMM dd, yyyy')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{code}</div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Description</th>
              <th style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', paddingBottom: 8, borderBottom: '1px solid var(--border)', width: 36 }}>Qty</th>
              <th style={{ textAlign: 'right', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', paddingBottom: 8, borderBottom: '1px solid var(--border)', width: 70 }}>Price</th>
              <th style={{ textAlign: 'right', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', paddingBottom: 8, borderBottom: '1px solid var(--border)', width: 70 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => {
              const lt = round2(item.qty * item.unitPrice);
              const isFree = lt === 0;
              return (
                <tr key={item.id || i}>
                  <td style={{ padding: '7px 0', color: 'var(--text)', fontSize: 12, borderBottom: i < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    {item.description || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No description</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '7px 0', color: 'var(--muted)', fontSize: 12, borderBottom: i < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>{item.qty}</td>
                  <td style={{ textAlign: 'right', padding: '7px 0', color: 'var(--muted)', fontSize: 12, borderBottom: i < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    {isFree ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>FREE</span> : fmt(item.unitPrice, sym)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 0', fontWeight: 700, fontSize: 12, color: isFree ? '#16a34a' : 'var(--text)', borderBottom: i < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    {isFree ? 'FREE' : fmt(lt, sym)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>Subtotal</span><span>{fmt(grossSubtotal, sym)}</span>
          </div>
          {discountRate > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16a34a' }}>
              <span>Discount ({discountRate}%)</span><span>−{fmt(discountAmount, sym)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
              <span>Tax ({taxRate}%)</span><span>+{fmt(taxAmount, sym)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', paddingTop: 5, borderTop: '1px dashed var(--border)' }}>
            <span>Processing Fee ({(feeRate * 100).toFixed(1)}%)</span><span>+{fmt(fee, sym)}</span>
          </div>
        </div>
        <div style={{ marginTop: 10, background: 'linear-gradient(135deg,#1f56d4,#1a42a0)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}>Total Payable</span>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(total, sym)}</span>
        </div>
        {exchangeRate !== 1 && (
          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 7 }}>
            Exchange rate: 1 INR = {exchangeRate.toFixed(5)} {code}
          </div>
        )}
        {notes && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: 'var(--muted)', borderLeft: '3px solid var(--blue)' }}>
            <strong>Notes:</strong> {notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();

  // Client fields
  const [clientName,  setClientName]  = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country,     setCountry]     = useState('India');
  const [clientType,  setClientType]  = useState<ClientType>('FRESHER');
  const [currencyOverride, setCurrencyOverride] = useState('');

  // Invoice settings
  const [lineItems,    setLineItems]    = useState<LineItem[]>([]);
  const [discountRate, setDiscountRate] = useState(0);
  const [taxRate,      setTaxRate]      = useState(0);
  const [notes,        setNotes]        = useState('');
  const [dueDays,      setDueDays]      = useState(7);

  // Currency state
  const [currencyInfo,  setCurrencyInfo]  = useState<CurrencyInfo | null>({ code: 'INR', symbol: '₹', name: 'Indian Rupee' });
  const [exchangeRate,  setExchangeRate]  = useState(1);
  const [rateLoading,   setRateLoading]   = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef   = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Fetch exchange rate when country or currency override changes
  const fetchRate = useCallback(async () => {
    if (!country) return;
    setRateLoading(true);
    try {
      const p = new URLSearchParams({ country });
      if (currencyOverride) p.set('currency', currencyOverride);
      const res  = await fetch(`/api/currency?${p}`);
      const data = await res.json();
      if (data.currency)     setCurrencyInfo(data.currency);
      if (data.exchangeRate) setExchangeRate(data.exchangeRate);
    } catch { /* silent */ }
    finally { setRateLoading(false); }
  }, [country, currencyOverride]);

  useEffect(() => {
    const t = setTimeout(fetchRate, 400);
    return () => clearTimeout(t);
  }, [fetchRate]);

  // Re-populate default items when client type or exchange rate changes
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
    }
    setLineItems(defaultItemsForType(clientType, exchangeRate));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientType, exchangeRate]);

  // ── Line item helpers ──
  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.lineTotal = round2(Number(updated.qty) * Number(updated.unitPrice));
      return updated;
    }));
  };

  const addItem = () => setLineItems(prev => [...prev, makeItem()]);
  const removeItem = (id: string) => setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim() || !country) {
      setError('Please fill in all required fields (Name, Email, Phone, Country).');
      return;
    }

    const normalizedPhone = normalizePhoneE164(clientPhone, country);
    if (!normalizedPhone) {
      setError('Invalid phone number. Select the correct country and enter a valid mobile number (or include +country code).');
      return;
    }

    const validItems = lineItems.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setError('Add at least one line item with a description.');
      return;
    }
    const grossTotal = validItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0);
    if (grossTotal <= 0) {
      setError('Invoice total must be greater than zero. At least one item must have a price.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: normalizedPhone.e164,
          companyName: companyName.trim() || undefined,
          country,
          clientType,
          currencyOverride: currencyOverride.trim() || undefined,
          lineItems: validItems,
          discountRate,
          taxRate,
          notes: notes.trim() || undefined,
          dueDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Invoice creation failed');
      }
      showToast('Invoice created & payment link sent!');
      setTimeout(() => router.push(`/invoices/${data.invoice.id}?created=true`), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      setSubmitting(false);
      // Scroll to error so it's visible
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  };

  const sym = currencyInfo?.symbol ?? '₹';
  const callingCode = getCallingCodeForCountryName(country);
  const phonePreview = clientPhone.trim() ? normalizePhoneE164(clientPhone, country) : null;

  return (
    <AppShell>
      <main className="page-wrapper" style={{ maxWidth: 1280 }}>
        {/* Breadcrumb + header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Dashboard</Link>
            <span>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>New Invoice</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
            Create Invoice
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            Add client details, line items, and send a branded payment link.
          </p>
        </div>

        {/* Split layout — stacks on mobile */}
        <div className="invoice-form-grid">

          {/* ── Left: Form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 1. Client Info */}
            <SectionCard title="Client Information" icon={<IconUser />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div
                      className="input"
                      style={{
                        width: 96,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: 'var(--text)',
                        background: '#f8fafc',
                      }}
                      aria-label="Country calling code"
                      title="Country calling code (based on selected country)"
                    >
                      {callingCode ? `+${callingCode}` : '—'}
                    </div>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      type="tel"
                      inputMode="tel"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      placeholder={country === 'India' ? 'e.g. 9876543210' : 'e.g. 4155552671 (or +country code)'}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: phonePreview ? 'var(--muted)' : '#ef4444' }}>
                    {clientPhone.trim()
                      ? (phonePreview
                        ? `Will be sent to Razorpay as: ${phonePreview.e164}`
                        : 'Invalid phone number for the selected country.'
                      )
                      : 'Enter a mobile number (we format it for international SMS).'
                    }
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label="Company / Organisation (optional)" />
                  <input className="input" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Google Inc." />
                </div>
                <div>
                  <FieldLabel label="Country" required />
                  <select className="input" value={country} onChange={e => { setCountry(e.target.value); setCurrencyOverride(''); }}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel label="Currency Override" />
                  <input
                    className="input"
                    type="text"
                    value={currencyOverride}
                    onChange={e => setCurrencyOverride(e.target.value.toUpperCase())}
                    placeholder={rateLoading ? 'Fetching…' : `Auto: ${currencyInfo?.code ?? 'INR'}`}
                    maxLength={3}
                  />
                </div>
              </div>
            </SectionCard>

            {/* 2. Career Level */}
            <SectionCard title="Career Level" icon={<IconTarget />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {CLIENT_TYPES.map(t => {
                  const meta = CLIENT_META[t];
                  const sel  = clientType === t;
                  const base = BASE_PRICING[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setClientType(t)}
                      style={{
                        border: `2px solid ${sel ? meta.color : 'var(--border)'}`,
                        background: sel ? `${meta.color}12` : '#fff',
                        borderRadius: 12, padding: '14px', cursor: 'pointer',
                        textAlign: 'left', transition: 'all .15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: sel ? meta.color : 'var(--text)' }}>
                          {CLIENT_TYPE_LABELS[t]}
                        </span>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? meta.color : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{meta.sub}</div>
                      <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, marginTop: 6 }}>
                        from ₹{base.resume + base.linkedin}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* 3. Line Items */}
            <SectionCard title="Line Items" icon={<IconList />} noPad>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 70 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 130 }}>Unit Price ({sym})</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 120 }}>Total</th>
                      <th style={{ width: 40, borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const lt = round2(item.qty * item.unitPrice);
                      return (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 10px', fontSize: 13 }}
                              type="text"
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Service description…"
                            />
                          </td>
                          <td style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 6px', fontSize: 13, textAlign: 'center', width: '100%' }}
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.qty}
                              onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 10px', fontSize: 13, textAlign: 'right', width: '100%' }}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, fontSize: 13, color: lt === 0 ? '#16a34a' : 'var(--text)', whiteSpace: 'nowrap' }}>
                            {lt === 0 ? 'FREE' : fmt(lt, sym)}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={lineItems.length === 1}
                              style={{ border: 'none', background: 'transparent', cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer', color: '#dc2626', opacity: lineItems.length === 1 ? 0.3 : 1, fontSize: 16, lineHeight: 1, padding: 4 }}
                              title="Remove row"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, padding: '8px 14px' }}
                >
                  + Add Item
                </button>
              </div>
            </SectionCard>

            {/* 4. Adjustments */}
            <SectionCard title="Invoice Settings" icon={<IconSettings />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <FieldLabel label="Discount %" />
                  <input
                    className="input"
                    type="number" min="0" max="100" step="0.5"
                    value={discountRate}
                    onChange={e => setDiscountRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel label="Tax %" />
                  <input
                    className="input"
                    type="number" min="0" max="100" step="0.5"
                    value={taxRate}
                    onChange={e => setTaxRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel label="Due In (days)" />
                  <input
                    className="input"
                    type="number" min="1" max="90" step="1"
                    value={dueDays}
                    onChange={e => setDueDays(Math.min(90, Math.max(1, parseInt(e.target.value) || 7)))}
                    placeholder="7"
                  />
                </div>
              </div>
              <div>
                <FieldLabel label="Notes (optional)" />
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes for the client…"
                  style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
                />
              </div>
            </SectionCard>

            {/* Error */}
            {error && (
              <div ref={errorRef} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 16px', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', marginTop: 1 }}>
                    <IconAlert size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                      {error.startsWith('Payment link creation failed') ? 'Razorpay Payment Link Error' : 'Error'}
                    </div>
                    <div style={{ color: '#b91c1c', lineHeight: 1.55 }}>{error}</div>
                    {error.includes('Razorpay') && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d', background: '#fee2e2', borderRadius: 8, padding: '8px 10px' }}>
                        <strong>Check:</strong> Razorpay API keys in Vercel env vars · Account enabled for this currency · Phone number is valid
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: 15, fontWeight: 700 }}
            >
              {submitting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', animation: 'spin 0.9s linear infinite' }}>
                    <IconSpinner />
                  </span>
                  Creating invoice...
                </span>
              ) : (
                'Create Invoice & Send Email'
              )}
            </button>
          </div>

          {/* ── Right: Sticky preview ── */}
          <div className="invoice-preview-col">
            {/* What happens next */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>What Happens Next</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  [<IconList key="inv" />, 'Unique invoice number generated'],
                  [<IconLink key="link" />, 'Razorpay payment link created'],
                  [<IconMail key="mail" />, 'Branded email sent instantly'],
                  [<IconCreditCard key="pay" />, 'Client pays via secure link'],
                  [<IconCheck key="ok" style={{ color: '#3FBD8B' }} />, 'Status auto-updates on payment'],
                ] as const).map(([icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      {icon}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10, paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Live Preview
              </div>
              <InvoicePreview
                clientName={clientName}
                clientEmail={clientEmail}
                clientType={clientType}
                country={country}
                companyName={companyName}
                lineItems={lineItems}
                discountRate={discountRate}
                taxRate={taxRate}
                notes={notes}
                dueDays={dueDays}
                currencyInfo={currencyInfo}
                exchangeRate={exchangeRate}
              />
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="toast-stack">
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            <span>{toast.type === 'error' ? '✕' : '✓'}</span>
            {toast.msg}
          </div>
        </div>
      )}
    </AppShell>
  );
}
