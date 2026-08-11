'use client';
// src/app/(protected)/settings/page.tsx
// Admin System Settings — visible to SUPER_ADMIN only
// Controls things like Premium Plus package toggle and pricing.

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

export default function SettingsPage() {
  const { isSuperAdmin } = useAdmin();

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
            Configure client-selective package upgrade offers and custom pricing overrides.
          </p>
        </div>

        <div style={{ maxWidth: 840, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SelectiveClientPricingSection />
        </div>
      </main>
    </AppShell>
  );
}

function SelectiveClientPricingSection() {
  type ClientCandidate = { id: string; name: string; email: string | null; sourceType: string };
  type SelectiveClientItem = {
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string | null;
    priceInr: number;
    priceUsd: number;
    enabled: boolean;
    updatedAt: string;
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientCandidate | null>(null);
  
  const [basePrice, setBasePrice] = useState<string>('');
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'INR'>('USD');

  const [loadingPrices, setLoadingPrices] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError?: boolean } | null>(null);

  const [activeClients, setActiveClients] = useState<SelectiveClientItem[]>([]);
  const [loadingActiveClients, setLoadingActiveClients] = useState(true);

  const fetchActiveClients = useCallback(async () => {
    setLoadingActiveClients(true);
    try {
      const res = await fetch('/api/admin/settings/selective-clients');
      if (res.ok) {
        const data = await res.json();
        setActiveClients(data.clients ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoadingActiveClients(false); }
  }, []);

  useEffect(() => {
    fetchActiveClients();
  }, [fetchActiveClients]);

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
      
      const inrValue = typeof inrData?.value === 'number' ? inrData.value : 0;
      const usdValue = typeof usdData?.value === 'number' ? usdData.value : 0;

      if (usdValue > 0) {
        setBasePrice(String(usdValue));
        setBaseCurrency('USD');
      } else if (inrValue > 0) {
        setBasePrice(String(inrValue));
        setBaseCurrency('INR');
      } else {
        setBasePrice('');
        setBaseCurrency('USD');
      }
    } catch {
      setStatusMsg({ msg: 'Failed to load existing overrides.', isError: true });
    } finally {
      setLoadingPrices(false);
    }
  };

  const saveOverride = async () => {
    if (!selectedClient || !basePrice.trim()) {
      setStatusMsg({ msg: 'Please enter a base price.', isError: true });
      return;
    }
    setSavingPrice(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/settings/selective-clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          clientEmail: selectedClient.email,
          basePrice: Number(basePrice),
          baseCurrency,
        }),
      });

      if (!res.ok) throw new Error();
      
      setStatusMsg({ msg: `Selective pricing & upgrade offer enabled for ${selectedClient.name}!` });
      fetchActiveClients();
    } catch {
      setStatusMsg({ msg: 'Failed to save selective pricing.', isError: true });
    } finally {
      setSavingPrice(false);
    }
  };

  const deleteOverride = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to remove selective pricing for ${clientName}? They will no longer see any upgrade offer.`)) return;
    try {
      const res = await fetch(`/api/admin/settings/selective-clients?clientId=${clientId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchActiveClients();
        if (selectedClient?.id === clientId) setSelectedClient(null);
      }
    } catch {
      alert('Failed to remove selective pricing.');
    }
  };

  return (
    <div className="card" style={{ overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', borderRadius: 10, fontSize: 16 }}>🎯</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Selective Client Upgrade Offers & Pricing</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Only clients listed below will see a selective upgrade offer on their dashboard.</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'var(--brand-light)', color: 'var(--brand)' }}>
          {activeClients.length} Active VIP Offers
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Client Search & Editor */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>➕ Assign Upgrade Offer to Client</span>
          </div>

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
                  placeholder="Type client name or email (e.g. Rahul Verma)…"
                />
                {searching && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin .9s linear infinite', fontSize: 14 }}>⟳</span>
                )}
                {results.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.14)', marginTop: 4, overflow: 'hidden' }}>
                    {results.map((c, idx) => (
                      <div
                        key={c.id}
                        onClick={() => selectClient(c)}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--brand-light)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.email}</div>
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
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading client settings…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 6 }}>
                      Custom Upgrade Price
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 12, fontSize: 15, fontWeight: 800, color: 'var(--muted)' }}>
                          {baseCurrency === 'INR' ? '₹' : '$'}
                        </span>
                        <input
                          className="input"
                          type="number"
                          placeholder="e.g. 59"
                          value={basePrice}
                          onChange={e => setBasePrice(e.target.value)}
                          style={{ paddingLeft: 30, width: '100%' }}
                        />
                      </div>
                      <select
                        className="input"
                        value={baseCurrency}
                        onChange={e => setBaseCurrency(e.target.value as 'INR' | 'USD')}
                        style={{ width: 100, flexShrink: 0 }}
                      >
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      The system will automatically calculate the equivalent {baseCurrency === 'USD' ? 'INR' : 'USD'} price using live exchange rates.
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
                {savingPrice ? 'Saving…' : 'Save & Enable Offer for Client'}
              </button>
            </div>
          )}
        </div>

        {/* Active Selective Clients List / Table */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Active Client Selective Upgrade List</span>
            <button
              type="button"
              onClick={fetchActiveClients}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              ⟳ Refresh List
            </button>
          </div>

          {loadingActiveClients ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading selective clients…</div>
          ) : activeClients.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface-2)', border: '1px border var(--border)', borderRadius: 12, color: 'var(--muted)', fontSize: 13 }}>
              No selective upgrade offers configured yet. Use the search box above to assign upgrade pricing to specific clients.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Client</th>
                    <th style={{ padding: '12px 16px' }}>Selective Price (INR)</th>
                    <th style={{ padding: '12px 16px' }}>Selective Price (USD)</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClients.map((item, idx) => (
                    <tr key={item.clientId} style={{ borderBottom: idx < activeClients.length - 1 ? '1px solid var(--border)' : 'none', background: '#fff' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.clientName}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.clientEmail}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                        {item.priceInr > 0 ? `₹${item.priceInr.toLocaleString('en-IN')}` : <span style={{ color: 'var(--muted)' }}>Global Default</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                        {item.priceUsd > 0 ? `$${item.priceUsd}` : <span style={{ color: 'var(--muted)' }}>Global Default</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                          ✓ ENABLED
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => selectClient({ id: item.clientId, name: item.clientName, email: item.clientEmail, sourceType: 'career_client' })}
                          >
                            ✏ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px', color: '#b91c1c' }}
                            onClick={() => deleteOverride(item.clientId, item.clientName)}
                          >
                            🗑 Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
