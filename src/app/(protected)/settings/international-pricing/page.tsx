'use client';
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
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">International Pricing Config</h1>
            <p className="text-sm text-gray-500 mt-1">
              Set fixed base prices for international currencies (e.g. EUR, GBP) to avoid awkward live exchange rate conversions.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <IconRefresh className="w-4 h-4 animate-spin" /> : saveSuccess ? <IconCheck className="w-4 h-4" /> : null}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><IconRefresh className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-12">
            {Object.keys(pricingMap).sort().map(currency => (
              <div key={currency} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-gray-900">{currency} Pricing</h2>
                  <button onClick={() => handleDeleteCurrency(currency)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove Currency</button>
                </div>
                <div className="p-6 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-gray-600">
                    <thead>
                      <tr>
                        <th className="pb-3 font-semibold text-gray-900">Service</th>
                        {TIERS.map(t => <th key={t} className="pb-3 font-semibold text-gray-900">{t}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {SERVICES.map(svc => (
                        <tr key={svc}>
                          <td className="py-4 font-medium text-gray-900">{svc}</td>
                          {TIERS.map(tier => (
                            <td key={tier} className="py-4 pr-4">
                              <div className="relative rounded-md shadow-sm w-32">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">{currency}</span>
                                </div>
                                <input
                                  type="number"
                                  value={pricingMap[currency]?.[svc as keyof GlobalCurrencyPricingMap[string]]?.[tier] || ''}
                                  onChange={e => handlePriceChange(currency, svc, tier, e.target.value)}
                                  className="form-input block w-full pl-12 pr-3 py-2 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
              <input 
                type="text" 
                maxLength={3}
                placeholder="e.g. EUR"
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value)}
                className="form-input block w-32 border-gray-300 rounded-md uppercase"
              />
              <button 
                onClick={handleAddCurrency}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Add Custom Currency
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
