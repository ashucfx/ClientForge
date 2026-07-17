'use client';
// src/app/(protected)/rn/retainers/new/page.tsx — Create new retainer

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import Link from 'next/link';

type Client = { id: string; name: string; companyName?: string | null; email: string; country?: string | null; currency?: string };

const RETAINER_TYPES = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'MAINTENANCE', 'CUSTOM'] as const;
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];
const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ' };

function getDefaultNextBilling(type: string): string {
  const d = new Date();
  if (type === 'ANNUAL')    d.setFullYear(d.getFullYear() + 1);
  else if (type === 'QUARTERLY') d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

export default function NewRetainerPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    name: '',
    type: 'MONTHLY' as typeof RETAINER_TYPES[number],
    amount: '',
    currency: 'INR',
    billingDay: '1',
    nextBillingAt: getDefaultNextBilling('MONTHLY'),
    autoRenew: true,
    notes: '',
    paymentGateway: '' as '' | 'RAZORPAY' | 'PAYPAL',
  });

  const selectedClient = clients.find(c => c.id === form.clientId);

  useEffect(() => {
    setLoading(true);
    fetch('/api/rn/clients?lifecycleStatus=ACTIVE&limit=200')
      .then(r => r.json())
      .then(d => setClients(d.clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-detect gateway from client country
  useEffect(() => {
    if (!selectedClient) return;
    const isIndia = ['india', 'in'].includes((selectedClient.country ?? '').toLowerCase());
    setForm(f => ({ ...f, paymentGateway: isIndia ? 'RAZORPAY' : 'PAYPAL', currency: selectedClient.currency ?? (isIndia ? 'INR' : 'USD') }));
  }, [form.clientId, selectedClient]);

  const setType = (type: typeof RETAINER_TYPES[number]) => {
    setForm(f => ({ ...f, type, nextBillingAt: getDefaultNextBilling(type) }));
  };

  const save = async () => {
    if (!form.clientId || !form.name || !form.amount || !form.nextBillingAt) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/rn/retainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          name: form.name,
          type: form.type,
          amount: Number(form.amount),
          currency: form.currency,
          billingDay: Number(form.billingDay),
          nextBillingAt: form.nextBillingAt,
          autoRenew: form.autoRenew,
          notes: form.notes || undefined,
          paymentGateway: form.paymentGateway || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create');
      router.push(`/rn/retainers/${data.retainer.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RippleNexusShell>
      <main className="rn-page" style={{ maxWidth: 720 }}>
        <header className="rn-page-header">
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>
              <Link href="/rn/retainers" style={{ color: 'inherit', textDecoration: 'none' }}>Retainers</Link>
              {' / New'}
            </div>
            <h1 className="rn-title-xl">New Retainer</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>Set up a recurring engagement for a client.</p>
          </div>
        </header>

        <div className="rn-panel">
          <div className="rn-panel-header">
            <h2 className="rn-panel-title">Contract Details</h2>
          </div>
          <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Client picker */}
            <div className="form-field">
              <label>Client <span style={{ color: 'var(--danger)' }}>*</span></label>
              {loading ? (
                <div className="rn-skeleton rn-skeleton-text" style={{ height: 42 }} />
              ) : (
                <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Select an active client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName || c.name} — {c.email}</option>
                  ))}
                </select>
              )}
              {selectedClient && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Country: {selectedClient.country ?? 'Unknown'} · Gateway auto-set to <strong style={{ color: 'var(--plasma)' }}>{form.paymentGateway || 'auto-detect'}</strong>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="form-field">
              <label>Retainer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="input" placeholder="e.g. Monthly SEO Retainer, Website Maintenance" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {/* Type chips */}
            <div className="form-field">
              <label>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RETAINER_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`rn-chip${form.type === t ? ' active' : ''}`}
                    onClick={() => setType(t)}
                    style={{ fontSize: 13 }}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Currency */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="form-field">
                <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 600 }}>
                    {CURRENCY_SYMBOLS[form.currency] ?? form.currency}
                  </span>
                  <input className="input" type="number" placeholder="0.00" min="0" step="0.01" style={{ paddingLeft: 32 }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="form-field">
                <label>Currency</label>
                <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Billing day + Next billing date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div className="form-field">
                <label>Billing Day</label>
                <select className="input" value={form.billingDay} onChange={e => setForm(f => ({ ...f, billingDay: e.target.value }))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="form-hint">Day of month to bill</div>
              </div>
              <div className="form-field">
                <label>Next Billing Date <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="input" type="date" value={form.nextBillingAt} onChange={e => setForm(f => ({ ...f, nextBillingAt: e.target.value }))} />
              </div>
            </div>

            {/* Payment gateway */}
            <div className="form-field">
              <label>Payment Gateway</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['RAZORPAY', 'PAYPAL'] as const).map(gw => (
                  <button
                    key={gw}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, paymentGateway: f.paymentGateway === gw ? '' : gw }))}
                    style={{
                      flex: 1, padding: '14px 16px', border: `2px solid ${form.paymentGateway === gw ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius: 12, background: form.paymentGateway === gw ? 'var(--brand-faint)' : 'var(--surface-3)',
                      cursor: 'pointer', transition: 'all 150ms var(--ease)', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{gw === 'RAZORPAY' ? '⚡' : '🌐'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.paymentGateway === gw ? 'var(--plasma)' : 'var(--text-primary)' }}>{gw === 'RAZORPAY' ? 'Razorpay' : 'PayPal'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{gw === 'RAZORPAY' ? 'India (INR)' : 'International'}</div>
                  </button>
                ))}
              </div>
              <div className="form-hint">Auto-detected from client country. Override if needed.</div>
            </div>

            {/* Auto-renew + Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="rn-checkbox-label">
                <input type="checkbox" checked={form.autoRenew} onChange={e => setForm(f => ({ ...f, autoRenew: e.target.checked }))} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Auto-renew</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Show renewal reminder when billing date approaches</div>
                </div>
              </label>
              <div className="form-field">
                <label>Notes <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <textarea className="input" rows={3} placeholder="Scope, deliverables, or special terms…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
            </div>

            {error && <div className="rn-alert danger" style={{ padding: '10px 14px' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Link href="/rn/retainers" className="btn-secondary">Cancel</Link>
              <button className="btn-primary" onClick={save} disabled={saving || !form.clientId || !form.name || !form.amount}>
                {saving ? 'Creating…' : 'Create Retainer'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
