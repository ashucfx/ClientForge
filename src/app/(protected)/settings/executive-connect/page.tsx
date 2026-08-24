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
          <div className="text-4xl mb-4">🔒</div>
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">💎</span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Executive Connect Global Pricing</h2>
            <p className="text-xs text-slate-500 mt-0.5">Set fixed prices for each currency. If blank, live exchange rates apply.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search currency..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleAutoFill}
            disabled={autoFilling || loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {autoFilling ? 'Fetching...' : 'Auto-Fill Missing'}
          </button>
          <button
            onClick={saveMap}
            disabled={saving || loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Prices'}
          </button>
        </div>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-slate-500">Currency Code</th>
                  <th className="px-6 py-3 font-semibold text-slate-500">Fixed Override Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCurrencies.map(code => (
                  <tr key={code} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{code}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className="text-slate-400 font-medium">{code}</span>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-900 font-medium"
                          placeholder="e.g. 100"
                          value={pricingMap[code] ?? ''}
                          onChange={e => setPricingMap(prev => ({ ...prev, [code]: e.target.value }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCurrencies.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-400">No currencies found matching "{search}"</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {statusMsg && (
        <div className={`m-4 p-3 rounded-xl text-sm font-semibold border ${statusMsg.isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {statusMsg.msg}
        </div>
      )}
    </div>
  );
}
