'use client';
// src/app/(protected)/settings/page.tsx
// Admin System Settings — visible to SUPER_ADMIN only
// Controls things like Premium Plus package toggle and pricing.

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

type SettingState = {
  PREMIUM_PLUS_ENABLED: boolean;
  PREMIUM_PLUS_PRICE_INR: number;
  PREMIUM_PLUS_PRICE_USD: number;
};

const DEFAULTS: SettingState = {
  PREMIUM_PLUS_ENABLED: false,
  PREMIUM_PLUS_PRICE_INR: 4999,
  PREMIUM_PLUS_PRICE_USD: 59,
};

export default function SettingsPage() {
  const { isSuperAdmin } = useAdmin();
  const [settings, setSettings] = useState<SettingState>(DEFAULTS);
  const [draft,    setDraft]    = useState<SettingState>(DEFAULTS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const keys: (keyof SettingState)[] = ['PREMIUM_PLUS_ENABLED', 'PREMIUM_PLUS_PRICE_INR', 'PREMIUM_PLUS_PRICE_USD'];
      const values = await Promise.all(
        keys.map(k => fetch(`/api/admin/settings/${k}`).then(r => r.json()) as Promise<{ key: string; value: unknown }>)
      );
      const merged: SettingState = { ...DEFAULTS };
      for (const { key, value } of values) {
        if (key === 'PREMIUM_PLUS_ENABLED')   merged.PREMIUM_PLUS_ENABLED   = value as boolean;
        if (key === 'PREMIUM_PLUS_PRICE_INR') merged.PREMIUM_PLUS_PRICE_INR = Number(value);
        if (key === 'PREMIUM_PLUS_PRICE_USD') merged.PREMIUM_PLUS_PRICE_USD = Number(value);
      }
      setSettings(merged);
      setDraft(merged);
    } catch {
      setError('Failed to load settings. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const entries = Object.entries(draft) as [keyof SettingState, boolean | number][];
      await Promise.all(
        entries.map(([key, value]) =>
          fetch(`/api/admin/settings/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
        )
      );
      setSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <main className="page-body">
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Access Restricted</h2>
            <p style={{ marginTop: 8, fontSize: 14 }}>System settings are only accessible to Super Admins.</p>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-body">
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
            System Settings
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Admin-controlled configuration that takes effect immediately without a code deployment.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14 }}>
            <span style={{ display: 'inline-flex', animation: 'spin .9s linear infinite' }}>⟳</span>
            Loading settings…
          </div>
        ) : (
          <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Premium Plus Package */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ede9fe', borderRadius: 8, fontSize: 15 }}>✨</span>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Premium Plus Package Upgrade</h2>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: draft.PREMIUM_PLUS_ENABLED ? '#dcfce7' : '#f1f5f9',
                  color:      draft.PREMIUM_PLUS_ENABLED ? '#15803d' : '#64748b',
                  border:     `1px solid ${draft.PREMIUM_PLUS_ENABLED ? '#bbf7d0' : '#e2e8f0'}`,
                }}>
                  {draft.PREMIUM_PLUS_ENABLED ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Enable upgrade offer</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      When enabled, eligible clients will see the Premium Plus upgrade banner on their portal dashboard.
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, PREMIUM_PLUS_ENABLED: !d.PREMIUM_PLUS_ENABLED }))}
                    style={{
                      flexShrink: 0,
                      width: 48, height: 26,
                      borderRadius: 13,
                      border: 'none',
                      cursor: 'pointer',
                      background: draft.PREMIUM_PLUS_ENABLED ? 'var(--brand)' : '#d1d5db',
                      position: 'relative',
                      transition: 'background .2s',
                    }}
                    aria-label={draft.PREMIUM_PLUS_ENABLED ? 'Disable Premium Plus' : 'Enable Premium Plus'}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 3, left: draft.PREMIUM_PLUS_ENABLED ? 25 : 3,
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                      transition: 'left .2s',
                    }} />
                  </button>
                </div>

                {/* INR Price */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
                    Price (INR) — shown to Indian clients
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--muted)' }}>₹</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step={1}
                      value={draft.PREMIUM_PLUS_PRICE_INR}
                      onChange={e => setDraft(d => ({ ...d, PREMIUM_PLUS_PRICE_INR: Number(e.target.value) }))}
                      style={{ maxWidth: 200 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                    Current live price: ₹{settings.PREMIUM_PLUS_PRICE_INR.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* USD Price */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
                    Price (USD) — shown to international clients
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--muted)' }}>$</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step={1}
                      value={draft.PREMIUM_PLUS_PRICE_USD}
                      onChange={e => setDraft(d => ({ ...d, PREMIUM_PLUS_PRICE_USD: Number(e.target.value) }))}
                      style={{ maxWidth: 200 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                    Current live price: ${settings.PREMIUM_PLUS_PRICE_USD}
                  </div>
                </div>

                {/* Notice */}
                <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e' }}>
                  <strong>⚠ Price changes only affect future upgrades.</strong>{' '}
                  Historical invoices and completed upgrade transactions are never modified.
                </div>
              </div>
            </div>

            {/* Selective Client Pricing Overrides */}
            <SelectiveClientPricingSection />

            {/* Save bar */}
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, fontSize: 13, color: '#b91c1c' }}>
                {error}
              </div>
            )}
            {saved && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✓ Settings saved successfully.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving || !isDirty}
                className="btn btn-primary"
                style={{ opacity: (saving || !isDirty) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px' }}
              >
                {saving ? <><span style={{ animation: 'spin .9s linear infinite', display: 'inline-flex' }}>⟳</span> Saving…</> : 'Save Settings'}
              </button>
              {isDirty && (
                <button
                  type="button"
                  onClick={() => setDraft(settings)}
                  disabled={saving}
                  className="btn btn-ghost"
                  style={{ opacity: saving ? 0.5 : 1, padding: '10px 18px' }}
                >
                  Discard changes
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function SelectiveClientPricingSection() {
  type ClientCandidate = { id: string; name: string; email: string | null; sourceType: string };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientCandidate | null>(null);
  const [customInr, setCustomInr] = useState<string>('');
  const [customUsd, setCustomUsd] = useState<string>('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError?: boolean } | null>(null);

  const searchClients = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/contacts/search?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const selectClient = async (client: ClientCandidate) => {
    setSelectedClient(client);
    setResults([]);
    setQuery('');
    setLoadingPrices(true);
    setStatusMsg(null);
    try {
      const [inrRes, usdRes] = await Promise.all([
        fetch(`/api/admin/settings/CLIENT_PRICE_${client.id}_INR`),
        fetch(`/api/admin/settings/CLIENT_PRICE_${client.id}_USD`),
      ]);
      const inrData = inrRes.ok ? await inrRes.json() : null;
      const usdData = usdRes.ok ? await usdRes.json() : null;
      setCustomInr(typeof inrData?.value === 'number' ? String(inrData.value) : '');
      setCustomUsd(typeof usdData?.value === 'number' ? String(usdData.value) : '');
    } catch {
      setStatusMsg({ msg: 'Failed to load existing overrides.', isError: true });
    } finally {
      setLoadingPrices(false);
    }
  };

  const saveOverride = async () => {
    if (!selectedClient) return;
    setSavingPrice(true);
    setStatusMsg(null);
    try {
      const inrVal = customInr.trim() ? Number(customInr) : 0;
      const usdVal = customUsd.trim() ? Number(customUsd) : 0;

      await Promise.all([
        fetch(`/api/admin/settings/CLIENT_PRICE_${selectedClient.id}_INR`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: inrVal }),
        }),
        fetch(`/api/admin/settings/CLIENT_PRICE_${selectedClient.id}_USD`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: usdVal }),
        }),
      ]);

      setStatusMsg({ msg: `Selective pricing saved for ${selectedClient.name}!` });
    } catch {
      setStatusMsg({ msg: 'Failed to save selective pricing.', isError: true });
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', borderRadius: 8, fontSize: 15 }}>🎯</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Selective Client Upgrade Pricing</h2>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Set custom package upgrade prices for specific VIP/custom clients.</div>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!selectedClient ? (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
              Search Client by Name or Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); searchClients(e.target.value); }}
                placeholder="e.g. Rahul Verma or rahul@example.com…"
              />
              {searching && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin .9s linear infinite', fontSize: 14 }}>⟳</span>
              )}
              {results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden' }}>
                  {results.map((c, idx) => (
                    <div
                      key={c.id}
                      onClick={() => selectClient(c)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--brand-light)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedClient.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedClient.email}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedClient(null)}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                ✕ Change Client
              </button>
            </div>

            {loadingPrices ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading client pricing settings…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
                    Custom Price (INR)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--muted)' }}>₹</span>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 3999"
                      value={customInr}
                      onChange={e => setCustomInr(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
                    Custom Price (USD)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--muted)' }}>$</span>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 49"
                      value={customUsd}
                      onChange={e => setCustomUsd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {statusMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: statusMsg.isError ? '#fef2f2' : '#f0fdf4',
                color: statusMsg.isError ? '#b91c1c' : '#15803d',
                border: `1px solid ${statusMsg.isError ? '#fca5a5' : '#bbf7d0'}`,
              }}>
                {statusMsg.msg}
              </div>
            )}

            <button
              type="button"
              onClick={saveOverride}
              disabled={savingPrice || loadingPrices}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', padding: '8px 18px', fontSize: 13 }}
            >
              {savingPrice ? 'Saving Custom Price…' : 'Save Client Override'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
