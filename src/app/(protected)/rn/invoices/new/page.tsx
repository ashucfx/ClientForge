'use client';
// src/app/(protected)/rn/invoices/new/page.tsx
// RIPPLE NEXUS INVOICE ENGINE
// Completely separated from Catalyst. Supports B2B services, milestones, retainers.
// NO Career Booster logic or Resume pricing.

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COUNTRIES } from '@/lib/currency';
import { FEE_RATES, round2 } from '@/lib/pricing';
import { getCallingCodeForCountryName, normalizePhoneE164 } from '@/lib/phone';
import type { LineItem, CurrencyInfo } from '@/types';
import { Logo } from '@/components/Logo';
import { IconAlert, IconList, IconTarget, IconUser } from '@/components/Icons';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { format, addDays } from 'date-fns';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(n: number, sym: string) { return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function makeItem(description = '', qty = 1, unitPrice = 0): LineItem { return { id: uid(), description, qty, unitPrice, lineTotal: round2(qty * unitPrice) }; }

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
      {label}{required && <span style={{ color: '#7C5CFF', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children, noPad }: { title: string; icon: React.ReactNode; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#7C5CFF' }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>{children}</div>
    </div>
  );
}

export default function RnNewInvoicePage() {
  const router = useRouter();

  // Client fields
  const [clientName,  setClientName]  = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country,     setCountry]     = useState('India');
  const [currencyOverride, setCurrencyOverride] = useState('');

  // RN Services
  const [rnServices, setRnServices] = useState<{ id: string; name: string; slug: string; workflowStages: string[] }[]>([]);
  const [selectedRnServiceId, setSelectedRnServiceId] = useState<string>('');

  // Invoice fields
  const [lineItems, setLineItems] = useState<LineItem[]>([makeItem('B2B Service / Retainer', 1, 0)]);
  const [discountRate, setDiscountRate] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [dueDays, setDueDays] = useState(7);
  const [paymentGateway, setPaymentGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  const [installmentCount, setInstallmentCount] = useState<1|2|3>(1);

  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>({ code: 'INR', symbol: '₹', name: 'Indian Rupee' });
  const [exchangeRate, setExchangeRate] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/rn/services').then(r => r.json()).then(d => {
      if (d.services) setRnServices(d.services);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!country) return;
    setRateLoading(true);
    const p = new URLSearchParams({ country });
    if (currencyOverride) p.set('currency', currencyOverride);
    fetch(`/api/currency?${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.currency) setCurrencyInfo(d.currency);
        if (d.exchangeRate) setExchangeRate(d.exchangeRate);
      })
      .catch(() => {})
      .finally(() => setRateLoading(false));
  }, [country, currencyOverride]);

  useEffect(() => {
    if (selectedRnServiceId) {
      const srv = rnServices.find(s => s.id === selectedRnServiceId);
      if (srv && srv.workflowStages && srv.workflowStages.length > 0) {
        setLineItems(srv.workflowStages.map((stage, idx) => makeItem(`Milestone ${idx + 1}: ${stage.replace(/_/g, ' ')}`, 1, 0)));
      } else if (srv) {
        setLineItems([makeItem(`Service: ${srv.name}`, 1, 0)]);
      }
    }
  }, [selectedRnServiceId, rnServices]);

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

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim() || !country) {
      setError('Please fill in all required fields.');
      return;
    }
    const normalizedPhone = normalizePhoneE164(clientPhone, country);
    if (!normalizedPhone) {
      setError('Invalid phone number.');
      return;
    }
    const validItems = lineItems.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    const grossTotal = validItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0);
    if (grossTotal <= 0) {
      setError('Invoice total must be greater than zero.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: normalizedPhone.e164,
          companyName: companyName.trim() || undefined,
          country,
          clientType: 'AGENCY_CLIENT',
          brandId: 'ripple_nexus',
          rnServiceId: selectedRnServiceId || undefined,
          currencyOverride: currencyOverride.trim() || undefined,
          paymentGateway: (currencyOverride.trim() || currencyInfo?.code || 'INR') === 'INR' ? 'RAZORPAY' : paymentGateway,
          installmentCount,
          lineItems: validItems,
          discountRate,
          taxRate,
          notes: notes.trim() || undefined,
          dueDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Creation failed');
      router.push(`/rn/invoices/${data.invoice.id}?created=true`);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
      setSubmitting(false);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const sym = currencyInfo?.symbol ?? '₹';
  const callingCode = getCallingCodeForCountryName(country);

  // Live total calc
  const grossSubtotal = round2(lineItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0));
  const discountAmount = round2(grossSubtotal * discountRate / 100);
  const afterDiscount = round2(grossSubtotal - discountAmount);
  const taxAmount = round2(afterDiscount * taxRate / 100);
  const subtotal = round2(afterDiscount + taxAmount);
  const feeRate = (currencyInfo?.code ?? 'INR') === 'INR' ? FEE_RATES.INR : FEE_RATES.INTERNATIONAL;
  const fee = round2(subtotal * feeRate);
  const total = round2(subtotal + fee);

  return (
    <RippleNexusShell>
      <main className="page-body">
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
            <Link href="/rn/clients" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Operations</Link>
            <span>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>New Invoice</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
            Create Agency Invoice
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            B2B Service billing and retainer setup.
          </p>
        </div>

        <div className="invoice-form-grid">
          {/* Left Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {error && (
              <div ref={errorRef} style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: 13, display: 'flex', gap: 10 }}>
                <IconAlert /> <div>{error}</div>
              </div>
            )}

            <SectionCard title="Client Information" icon={<IconUser />}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label="Full Name" required />
                  <input className="input" type="text" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>
                <div>
                  <FieldLabel label="Email Address" required />
                  <input className="input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                </div>
                <div>
                  <FieldLabel label="Phone Number" required />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="input" style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700 }}>
                      {callingCode ? `+${callingCode}` : '—'}
                    </div>
                    <input className="input" style={{ flex: 1 }} type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label="Company / Organisation (optional)" />
                  <input className="input" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} />
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
                  <input className="input" type="text" value={currencyOverride} onChange={e => setCurrencyOverride(e.target.value.toUpperCase())} placeholder={`Auto: ${currencyInfo?.code ?? 'INR'}`} maxLength={3} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Service Module" icon={<IconTarget />}>
              <FieldLabel label="Select Service" required />
              <select className="input" value={selectedRnServiceId} onChange={e => setSelectedRnServiceId(e.target.value)}>
                <option value="">-- Custom / Other --</option>
                {rnServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </SectionCard>

            <SectionCard title="Line Items" icon={<IconList />} noPad>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>DESCRIPTION</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 70 }}>QTY</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 130 }}>PRICE ({sym})</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 120 }}>TOTAL</th>
                      <th style={{ width: 40, borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                          <input className="input" style={{ margin: 0, padding: '7px 10px', fontSize: 13 }} type="text" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <input className="input" style={{ margin: 0, padding: '7px 6px', fontSize: 13, textAlign: 'center' }} type="number" min="0.01" step="0.01" value={item.qty} onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                          <input className="input" style={{ margin: 0, padding: '7px 10px', fontSize: 13, textAlign: 'right' }} type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                          {item.lineTotal === 0 ? <span style={{ color: '#16a34a' }}>FREE</span> : fmt(item.lineTotal, sym)}
                        </td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <button type="button" onClick={() => removeItem(item.id)} disabled={lineItems.length === 1} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', opacity: lineItems.length === 1 ? 0.3 : 1, fontSize: 16 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={addItem} className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>+ Add Item</button>
              </div>
            </SectionCard>
          </div>

          {/* Right Summary */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>Invoice Summary</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span><span>{fmt(grossSubtotal, sym)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Processing Fee ({(feeRate * 100).toFixed(1)}%)</span><span>{fmt(fee, sym)}</span>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: 'var(--text)' }}>Total Payable</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: '#7C5CFF' }}>{fmt(total, sym)}</span>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 24, height: 48, fontSize: 15, background: '#7C5CFF', borderColor: '#7C5CFF' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create & Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
