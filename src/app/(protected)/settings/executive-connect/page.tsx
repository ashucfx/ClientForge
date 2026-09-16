'use client';
// src/app/(protected)/settings/page.tsx
// Admin System Settings — visible to SUPER_ADMIN only
// Controls client-selective package upgrade offers and custom pricing overrides.

import { useState, useEffect, useCallback } from 'react';
import { ALL_CURRENCIES } from '@/lib/allCurrencies';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';

export default function SettingsPage() {
  const { isSuperAdmin } = useAdmin();

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Executive Connect pricing is only accessible to Super Admins.</p>
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
            Executive Connect Pricing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure system-wide overrides for Executive Connect local currency rates.
          </p>
        </div>

        <ExecutiveConnectPricingSection />
      </div>
    </AppShell>
  );
}


function ExecutiveConnectPricingSection() {
  const [pricingMap, setPricingMap] = useState<Record<string, number | ''>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ msg: string; isError?: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings/executive-connect')
      .then(res => res.json())
      .then(data => {
        if (data.map) {
          setPricingMap(data.map);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveMap = async () => {
    setSaving(true);
    setStatusMsg(null);
    
    // Clean up empty strings
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(pricingMap)) {
      if (v !== '' && !isNaN(Number(v))) {
        cleaned[k] = Number(v);
      }
    }

    try {
      const res = await fetch('/api/admin/settings/executive-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });
      if (res.ok) {
        setStatusMsg({ msg: 'Executive Connect pricing saved successfully!' });
      } else {
        throw new Error();
      }
    } catch {
      setStatusMsg({ msg: 'Failed to save pricing map.', isError: true });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = async () => {
    if (!confirm('This will fetch live exchange rates from the API and auto-fill any empty fields. Existing overrides will NOT be overwritten. Proceed?')) return;
    
    setAutoFilling(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/settings/executive-connect/auto-fill');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPricingMap(prev => {
        const next = { ...prev };
        for (const [code, suggestedPrice] of Object.entries(data.suggestedPrices || {})) {
          // Only fill if it doesn't exist or is empty
          if (next[code] === undefined || next[code] === '') {
            next[code] = suggestedPrice as number;
          }
        }
        return next;
      });
      setStatusMsg({ msg: 'Missing prices have been auto-filled. Review and click Save to apply.' });
    } catch {
      setStatusMsg({ msg: 'Failed to fetch auto-fill rates.', isError: true });
    } finally {
      setAutoFilling(false);
    }
  };

  const filteredCurrencies = ALL_CURRENCIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  const configuredCount = Object.values(pricingMap).filter(v => v !== '' && !isNaN(Number(v))).length;

  return (
    <div className="space-y-6">
      {/* ── Metrics Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Currencies</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{ALL_CURRENCIES.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#B8935B] uppercase tracking-wider">Fixed Overrides</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{configuredCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] flex items-center justify-center text-[#B8935B]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Fallback Mechanism</div>
            <div className="text-sm font-bold text-slate-900 mt-1">Live Exchange API</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center text-sm font-bold shadow-xs">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Executive Connect Global Rate Card</h2>
              <p className="text-xs text-slate-500 mt-0.5">Fixed rate overrides for Executive Connect by local currency.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:w-52">
              <input 
                type="text" 
                placeholder="Search currency…" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] transition-all shadow-xs"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleAutoFill}
              disabled={autoFilling || loading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={autoFilling ? 'animate-spin text-[#B8935B]' : ''}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{autoFilling ? 'Fetching…' : 'Auto-Fill Missing'}</span>
            </button>

            <button
              onClick={saveMap}
              disabled={saving || loading}
              className="px-4 py-2 bg-[#B8935B] hover:bg-[#9A7540] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{saving ? 'Saving…' : 'Save Rates'}</span>
            </button>
          </div>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-sm">
              <div className="animate-spin w-5 h-5 border-2 border-[#B8935B] border-t-transparent rounded-full mx-auto mb-2" />
              Loading exchange rate mappings…
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Currency Code</th>
                    <th className="px-5 py-3">Fixed Override Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCurrencies.map(code => (
                    <tr key={code} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        <span className="font-mono px-2 py-0.5 rounded-md bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] font-bold text-xs">
                          {code}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 max-w-[220px]">
                          <span className="text-slate-400 font-medium text-xs">{code}</span>
                          <input
                            type="number"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
                            placeholder="Leave blank for live"
                            value={pricingMap[code] ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              setPricingMap(prev => ({ ...prev, [code]: val === '' ? '' : Number(val) }));
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCurrencies.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-6 py-12 text-center text-slate-400 text-xs">
                        No currencies found matching &quot;{search}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {statusMsg && (
          <div className={`m-4 p-3.5 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-2 ${
            statusMsg.isError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0">
              {statusMsg.isError ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span>{statusMsg.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
