'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { IconCheck, IconRefresh } from '@/components/Icons';

type GlobalCurrencyPricingMap = {
  [currency: string]: {
    RESUME: Record<string, number>;
    LINKEDIN: Record<string, number>;
    COVER_LETTER: Record<string, number>;
    PORTFOLIO: Record<string, number>;
  };
};

const SERVICES = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'] as const;
const TIERS = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'] as const;
const COMMON_CURRENCIES = ['EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR'];

export default function InternationalPricingPage() {
  const { isSuperAdmin } = useAdmin();
  const [pricingMap, setPricingMap] = useState<GlobalCurrencyPricingMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings/international-pricing');
      if (res.ok) {
        const data = await res.json();
        setPricingMap(data.pricingMap || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isSuperAdmin) return alert('Super Admin only');
    try {
      setSaving(true);
      const res = await fetch('/api/admin/settings/international-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingMap),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to save');
      }
    } catch (err) {
      alert('Error saving data');
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (currency: string, service: string, tier: string, value: string) => {
    const num = parseInt(value, 10);
    setPricingMap(prev => {
      const next = { ...prev };
      if (!next[currency]) {
        next[currency] = { RESUME: {}, LINKEDIN: {}, COVER_LETTER: {}, PORTFOLIO: {} };
      }
      const svc = service as keyof GlobalCurrencyPricingMap[string];
      next[currency][svc][tier] = isNaN(num) ? 0 : num;
      return next;
    });
  };

  const handleAddCurrency = () => {
    const cur = newCurrency.trim().toUpperCase();
    if (cur.length === 3 && !pricingMap[cur]) {
      setPricingMap(prev => ({
        ...prev,
        [cur]: { RESUME: {}, LINKEDIN: {}, COVER_LETTER: {}, PORTFOLIO: {} }
      }));
      setNewCurrency('');
    }
  };

  const handleDeleteCurrency = (cur: string) => {
    if (confirm(`Are you sure you want to delete all custom pricing for ${cur}?`)) {
      setPricingMap(prev => {
        const next = { ...prev };
        delete next[cur];
        return next;
      });
    }
  };

  if (!isSuperAdmin) {
    return <AppShell><div className="p-6">Unauthorized. Super admin access required.</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>International Pricing Configuration</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Fixed International Overrides</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Set fixed base prices for international currencies (e.g. EUR, GBP) to avoid awkward live exchange rate conversions.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="self-start sm:self-auto px-4 py-2 bg-[#B8935B] hover:bg-[#9A7540] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <IconRefresh className="w-4 h-4 animate-spin" /> : saveSuccess ? <IconCheck className="w-4 h-4" /> : null}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* ── Sub Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <Link
            href="/settings/global-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Base Pricing (INR &amp; USD Anchor)
          </Link>
          <Link
            href="/settings/international-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#B8935B] text-white shadow-xs"
          >
            Fixed International Overrides
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center p-16"><IconRefresh className="w-6 h-6 animate-spin text-[#B8935B]" /></div>
        ) : (
          <div className="space-y-8">
            {Object.keys(pricingMap).sort().map(currency => (
              <div key={currency} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B]">
                      {currency}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">{currency} Fixed Pricing Matrix</h2>
                  </div>
                  <button onClick={() => handleDeleteCurrency(currency)} className="text-rose-600 hover:text-rose-700 text-xs font-semibold">Remove Currency</button>
                </div>
                <div className="p-6 overflow-x-auto">
                  <table className="min-w-full text-left text-xs sm:text-sm text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-200/60 pb-3">
                        <th className="pb-3 font-bold text-slate-900 uppercase text-[11px]">Service</th>
                        {TIERS.map(t => <th key={t} className="pb-3 font-bold text-slate-900 uppercase text-[11px]">{t.replace('_', ' ')}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {SERVICES.map(svc => (
                        <tr key={svc}>
                          <td className="py-3.5 font-semibold text-slate-900">{svc.replace('_', ' ')}</td>
                          {TIERS.map(tier => (
                            <td key={tier} className="py-3.5 pr-4">
                              <div className="relative rounded-xl shadow-xs w-32">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-slate-400 text-xs font-mono">{currency}</span>
                                </div>
                                <input
                                  type="number"
                                  value={pricingMap[currency]?.[svc as keyof GlobalCurrencyPricingMap[string]]?.[tier] || ''}
                                  onChange={e => handlePriceChange(currency, svc, tier, e.target.value)}
                                  className="block w-full pl-12 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] font-semibold text-slate-900"
                                  placeholder="API Fallback"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 flex items-center gap-3">
              <input 
                type="text" 
                maxLength={3}
                placeholder="e.g. EUR"
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value)}
                className="block w-32 px-3 py-2 border border-slate-200 rounded-xl uppercase text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B]"
              />
              <button 
                onClick={handleAddCurrency}
                className="px-4 py-2 bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] font-bold rounded-xl text-xs sm:text-sm hover:bg-[#F4EFE6] transition-colors"
              >
                + Add Custom Currency
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
