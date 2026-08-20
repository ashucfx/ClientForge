'use client';
// src/app/(protected)/settings/page.tsx
// Admin System Settings — visible to SUPER_ADMIN only
// Controls client-selective package upgrade offers and custom pricing overrides.

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

export default function SettingsPage() {
  const { isSuperAdmin } = useAdmin();

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">System settings are only accessible to Super Admins.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Configuration Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            System Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure client-selective package upgrade offers and custom pricing overrides.
          </p>
        </div>

        <SelectiveClientPricingSection />
      </div>
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
    <div className="space-y-6">
      {/* ── Assign Offer Card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">🎯</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Selective Client Upgrade Offers &amp; Pricing</h2>
              <p className="text-xs text-slate-500 mt-0.5">Only clients assigned below will receive custom upgrade prompts.</p>
            </div>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#B8935B]/10 text-[#B8935B] border border-[#B8935B]/20">
            {activeClients.length} Active VIP Offers
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {!selectedClient ? (
            <div className="max-w-xl">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Search Client by Name or Email
              </label>
              <div className="relative">
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); searchClients(e.target.value); }}
                  placeholder="Type client name or email (e.g. Rahul Verma)…"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs animate-spin">⟳</span>
                )}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden max-h-60 overflow-y-auto">
                    {results.map((c, idx) => (
                      <div
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${idx < results.length - 1 ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{c.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{selectedClient.name}</div>
                  <div className="text-xs text-slate-500 truncate">{selectedClient.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0 ml-3"
                >
                  ✕ Change
                </button>
              </div>

              {loadingPrices ? (
                <div className="text-xs text-slate-400 py-2">Loading client settings…</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Custom Upgrade Price
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                          {baseCurrency === 'INR' ? '₹' : '$'}
                        </span>
                        <input
                          className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
                          type="number"
                          placeholder="e.g. 59"
                          value={basePrice}
                          onChange={e => setBasePrice(e.target.value)}
                        />
                      </div>
                      <select
                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B] shrink-0"
                        value={baseCurrency}
                        onChange={e => setBaseCurrency(e.target.value as 'INR' | 'USD')}
                      >
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      System automatically synchronizes equivalent currency price in real-time.
                    </p>
                  </div>
                </div>
              )}

              {statusMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${statusMsg.isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {statusMsg.msg}
                </div>
              )}

              <button
                type="button"
                onClick={saveOverride}
                disabled={savingPrice || loadingPrices}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {savingPrice ? 'Saving…' : 'Save & Enable Offer for Client'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Active VIP Offers List ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900">Active Client Selective Upgrade List</h2>
          <button
            type="button"
            onClick={fetchActiveClients}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            ⟳ Refresh
          </button>
        </div>

        {loadingActiveClients ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading selective clients…</div>
        ) : activeClients.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 text-sm">
            No selective upgrade offers configured yet. Use the search box above to assign upgrade pricing to specific clients.
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md screens) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {activeClients.map(item => (
                <div key={item.clientId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{item.clientName}</div>
                      <div className="text-xs text-slate-500 truncate">{item.clientEmail}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      ✓ Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-400 text-[10px] font-semibold uppercase">INR Price</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {item.priceInr > 0 ? `₹${item.priceInr.toLocaleString('en-IN')}` : 'Global Default'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-400 text-[10px] font-semibold uppercase">USD Price</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {item.priceUsd > 0 ? `$${item.priceUsd}` : 'Global Default'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => selectClient({ id: item.clientId, name: item.clientName, email: item.clientEmail, sourceType: 'career_client' })}
                      className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors text-center"
                    >
                      ✏ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOverride(item.clientId, item.clientName)}
                      className="flex-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors border border-rose-200 text-center"
                    >
                      🗑 Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md screens) */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Client</th>
                    <th className="px-4 py-3">Selective Price (INR)</th>
                    <th className="px-4 py-3">Selective Price (USD)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeClients.map(item => (
                    <tr key={item.clientId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{item.clientName}</div>
                        <div className="text-xs text-slate-500">{item.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {item.priceInr > 0 ? `₹${item.priceInr.toLocaleString('en-IN')}` : <span className="text-slate-400 font-normal">Global Default</span>}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {item.priceUsd > 0 ? `$${item.priceUsd}` : <span className="text-slate-400 font-normal">Global Default</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ ENABLED
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                            onClick={() => selectClient({ id: item.clientId, name: item.clientName, email: item.clientEmail, sourceType: 'career_client' })}
                          >
                            ✏ Edit
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors border border-rose-200"
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
          </>
        )}
      </div>
    </div>
  );
}
