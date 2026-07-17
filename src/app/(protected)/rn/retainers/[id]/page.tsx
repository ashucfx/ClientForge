'use client';
// src/app/(protected)/rn/retainers/[id]/page.tsx — Retainer Detail & Management

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import Link from 'next/link';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: 'success', PAUSED: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral' };

type Retainer = {
  id: string; name: string; type: string; amount: number; currency: string;
  billingDay: number; status: string; nextBillingAt: string; lastBilledAt?: string | null;
  autoRenew: boolean; notes?: string | null; paymentGateway: string;
  invoiceIds: string[]; createdAt: string; updatedAt: string;
  client: { id: string; name: string; companyName?: string | null; email: string; country?: string | null };
};

export default function RetainerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [retainer, setRetainer] = useState<Retainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patch, setPatch] = useState<Partial<Retainer>>({});

  useEffect(() => {
    fetch(`/api/rn/retainers/${id}`)
      .then(r => r.json())
      .then(d => { setRetainer(d.retainer); setPatch({}); })
      .catch(() => setError('Failed to load retainer'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!retainer) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rn/retainers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Update failed');
      setRetainer(data.retainer);
      setEditing(false);
      setPatch({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!confirm(`Set retainer status to ${status}?`)) return;
    const res = await fetch(`/api/rn/retainers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) setRetainer(data.retainer);
  };

  const markBilled = async () => {
    if (!retainer) return;
    // Advance next billing date by one period
    const next = new Date(retainer.nextBillingAt);
    if (retainer.type === 'MONTHLY')     next.setMonth(next.getMonth() + 1);
    else if (retainer.type === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
    else if (retainer.type === 'ANNUAL')   next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);

    const res = await fetch(`/api/rn/retainers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastBilledAt: new Date().toISOString(), nextBillingAt: next.toISOString() }),
    });
    const data = await res.json();
    if (res.ok) setRetainer(data.retainer);
  };

  if (loading) return (
    <RippleNexusShell>
      <main className="rn-page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="rn-skeleton" style={{ height: 80, borderRadius: 16 }} />)}
        </div>
      </main>
    </RippleNexusShell>
  );

  if (!retainer) return (
    <RippleNexusShell>
      <main className="rn-page">
        <div className="rn-alert danger">{error ?? 'Retainer not found'}</div>
      </main>
    </RippleNexusShell>
  );

  const sym = CURRENCY_SYMBOLS[retainer.currency] ?? retainer.currency;
  const daysLeft = Math.ceil((new Date(retainer.nextBillingAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isBillingDue = daysLeft <= 7 && retainer.status === 'ACTIVE';

  return (
    <RippleNexusShell>
      <main className="rn-page" style={{ maxWidth: 900 }}>
        <header className="rn-page-header">
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>
              <Link href="/rn/retainers" style={{ color: 'inherit', textDecoration: 'none' }}>Retainers</Link>
              {' / '}
              {retainer.client.companyName || retainer.client.name}
            </div>
            <h1 className="rn-title-xl">{retainer.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span className={`rn-badge ${STATUS_COLORS[retainer.status] ?? 'neutral'}`} style={{ fontSize: 13 }}>
                {retainer.status}
              </span>
              <span className={`rn-badge ${retainer.paymentGateway === 'PAYPAL' ? 'cyan' : 'brand'}`}>
                {retainer.paymentGateway === 'PAYPAL' ? '🌐 PayPal' : '⚡ Razorpay'}
              </span>
              <span className="rn-badge neutral">{retainer.type}</span>
              {retainer.autoRenew && <span className="rn-badge lime">↻ Auto-renew</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {retainer.status === 'ACTIVE' && (
              <>
                <button className="btn-secondary" onClick={markBilled} style={{ fontSize: 13 }}>
                  ✓ Mark Billed & Advance
                </button>
                <Link href={`/rn/invoices/new?clientId=${retainer.client.id}&retainerId=${retainer.id}&amount=${retainer.amount}&currency=${retainer.currency}`} className="btn-primary" style={{ fontSize: 13 }}>
                  + Create Invoice
                </Link>
              </>
            )}
            {!editing
              ? <button className="btn-secondary" onClick={() => setEditing(true)} style={{ fontSize: 13 }}>Edit</button>
              : <button className="btn-primary" onClick={save} disabled={saving} style={{ fontSize: 13 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
            }
          </div>
        </header>

        {isBillingDue && (
          <div className="rn-alert warning" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <div>
              <strong>Billing due {daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}</strong>
              {' — '}{format(new Date(retainer.nextBillingAt), 'MMMM d, yyyy')}. Create an invoice or mark as billed.
            </div>
          </div>
        )}

        <div className="rn-two-col">
          {/* Contract details */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Contract Details</h2>
              {editing && <button className="rn-close-btn" onClick={() => { setEditing(false); setPatch({}); }}>×</button>}
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {editing ? (
                <>
                  <div className="form-field">
                    <label>Retainer Name</label>
                    <input className="input" defaultValue={retainer.name} onChange={e => setPatch(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-field">
                      <label>Amount</label>
                      <input className="input" type="number" defaultValue={retainer.amount} onChange={e => setPatch(p => ({ ...p, amount: Number(e.target.value) }))} />
                    </div>
                    <div className="form-field">
                      <label>Gateway</label>
                      <select className="input" defaultValue={retainer.paymentGateway} onChange={e => setPatch(p => ({ ...p, paymentGateway: e.target.value }))}>
                        <option value="RAZORPAY">Razorpay (India)</option>
                        <option value="PAYPAL">PayPal (International)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Next Billing Date</label>
                    <input className="input" type="date" defaultValue={retainer.nextBillingAt.split('T')[0]} onChange={e => setPatch(p => ({ ...p, nextBillingAt: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Notes</label>
                    <textarea className="input" rows={3} defaultValue={retainer.notes ?? ''} onChange={e => setPatch(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  <label className="rn-checkbox-label">
                    <input type="checkbox" defaultChecked={retainer.autoRenew} onChange={e => setPatch(p => ({ ...p, autoRenew: e.target.checked }))} />
                    Auto-renew
                  </label>
                </>
              ) : (
                <>
                  <DetailRow label="Client">
                    <Link href={`/rn/projects/${retainer.client.id}`} style={{ color: 'var(--plasma)', textDecoration: 'none', fontWeight: 600 }}>
                      {retainer.client.companyName || retainer.client.name}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{retainer.client.email}</div>
                  </DetailRow>
                  <DetailRow label="Amount"><span style={{ fontSize: 18, fontWeight: 800 }}>{sym}{retainer.amount.toLocaleString()}</span> <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/ {retainer.type.toLowerCase()}</span></DetailRow>
                  <DetailRow label="Next Billing"><span style={{ fontWeight: 700, color: isBillingDue ? 'var(--warning)' : 'var(--text-primary)' }}>{format(new Date(retainer.nextBillingAt), 'MMMM d, yyyy')}</span></DetailRow>
                  <DetailRow label="Last Billed">{retainer.lastBilledAt ? format(new Date(retainer.lastBilledAt), 'MMMM d, yyyy') : <span style={{ color: 'var(--text-tertiary)' }}>Never</span>}</DetailRow>
                  <DetailRow label="Billing Day">Day {retainer.billingDay} of each month</DetailRow>
                  {retainer.notes && <DetailRow label="Notes"><span style={{ color: 'var(--text-secondary)' }}>{retainer.notes}</span></DetailRow>}
                </>
              )}
              {error && <div className="rn-alert danger" style={{ padding: '10px 14px', fontSize: 13 }}>{error}</div>}
            </div>
          </div>

          {/* Status + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="rn-panel">
              <div className="rn-panel-header"><h2 className="rn-panel-title">Status Management</h2></div>
              <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {retainer.status !== 'ACTIVE' && (
                  <button className="btn-primary" onClick={() => setStatus('ACTIVE')} style={{ width: '100%', justifyContent: 'center' }}>
                    ▶ Activate
                  </button>
                )}
                {retainer.status === 'ACTIVE' && (
                  <button className="btn-secondary" onClick={() => setStatus('PAUSED')} style={{ width: '100%', justifyContent: 'center' }}>
                    ⏸ Pause
                  </button>
                )}
                {retainer.status !== 'CANCELLED' && (
                  <button className="btn-danger" onClick={() => setStatus('CANCELLED')} style={{ width: '100%', justifyContent: 'center' }}>
                    ✕ Cancel Contract
                  </button>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}>
                  Cancelling soft-deletes — history is retained.
                </div>
              </div>
            </div>

            <div className="rn-panel">
              <div className="rn-panel-header"><h2 className="rn-panel-title">Quick Links</h2></div>
              <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={`/rn/projects/${retainer.client.id}`} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>View Project →</Link>
                <Link href={`/rn/invoices?clientId=${retainer.client.id}`} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>Invoice History →</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, paddingTop: 2, width: 110 }}>{label}</span>
      <div style={{ textAlign: 'right', fontSize: 14, color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}

function format(date: Date, fmt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: fmt.includes('yyyy') ? 'numeric' : undefined,
    month: fmt.includes('MMMM') ? 'long' : fmt.includes('MMM') ? 'short' : undefined,
    day: fmt.includes('d') ? 'numeric' : undefined,
  }).format(date);
}
