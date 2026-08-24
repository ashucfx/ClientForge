'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { DEFAULT_PRICING } from '@/lib/pricing-v2';
import type { PricingConfig } from '@/lib/pricing-v2';

const TIERS = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'] as const;
const SERVICES = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO', 'EXECUTIVE_CONNECT'] as const;

export default function GlobalPricingPage() {
  const { isSuperAdmin } = useAdmin();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings/global-pricing');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      } else {
        setConfig(DEFAULT_PRICING);
      }
    } catch (err) {
      console.error(err);
      setConfig(DEFAULT_PRICING);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isSuperAdmin) return alert('Super Admin only');
    try {
      setSaving(true);
      const res = await fetch('/api/admin/settings/global-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to save configuration');
      }
    } catch (err) {
      alert('Error saving data');
    } finally {
      setSaving(false);
    }
  };

  const updateBasePrice = (currency: 'INR' | 'USD', service: string, tier: string, value: string) => {
    if (!config) return;
    const num = parseInt(value, 10);
    setConfig({
      ...config,
      basePrices: {
        ...config.basePrices,
        [currency]: {
          ...config.basePrices[currency],
          [service]: {
            // @ts-ignore
            ...config.basePrices[currency][service],
            [tier]: isNaN(num) ? 0 : num
          }
        }
      }
    });
  };

  const updateDiscount = (pkg: string, value: string) => {
    if (!config) return;
    const num = parseFloat(value);
    setConfig({
      ...config,
      packageDiscounts: {
        ...config.packageDiscounts,
        [pkg]: isNaN(num) ? 0 : num / 100 // convert back to decimal
      }
    });
  };

  if (loading || !config) return <AppShell><div className="p-8">Loading...</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Global Pricing Engine</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage base prices for Indian clients (INR) and the Global base (USD) used to auto-convert for 180+ international currencies.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !isSuperAdmin}
            className="px-4 py-2 bg-[#B8935B] hover:bg-[#9A7540] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Configuration'}
          </button>
        </div>

        {/* INR Base Prices */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900">🇮🇳 Indian Pricing (INR)</h2>
            <p className="text-xs text-slate-500">Fixed prices charged to clients in India.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Service</th>
                  {TIERS.map(t => <th key={t} className="px-6 py-3">{t.replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SERVICES.map(svc => (
                  <tr key={svc} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{svc.replace('_', ' ')}</td>
                    {TIERS.map(tier => (
                      <td key={tier} className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            // @ts-ignore
                            value={config.basePrices.INR[svc]?.[tier] ?? 0}
                            onChange={(e) => updateBasePrice('INR', svc, tier, e.target.value)}
                            className="w-24 px-2 py-1 rounded border border-slate-200 text-sm focus:ring-[#B8935B]"
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

        {/* USD Base Prices */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900">🌍 International Base Pricing (USD)</h2>
            <p className="text-xs text-slate-500">Serves as the global anchor. Will be automatically converted to 180+ local currencies (EUR, GBP, CAD, etc.) at live rates.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Service</th>
                  {TIERS.map(t => <th key={t} className="px-6 py-3">{t.replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SERVICES.map(svc => (
                  <tr key={svc} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{svc.replace('_', ' ')}</td>
                    {TIERS.map(tier => (
                      <td key={tier} className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            // @ts-ignore
                            value={config.basePrices.USD[svc]?.[tier] ?? 0}
                            onChange={(e) => updateBasePrice('USD', svc, tier, e.target.value)}
                            className="w-24 px-2 py-1 rounded border border-slate-200 text-sm focus:ring-[#B8935B]"
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

        {/* Package Discounts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900">📦 Package Discounts</h2>
            <p className="text-xs text-slate-500">Percentage discount applied to standard upgrade packages.</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Career Booster (%)</label>
              <input
                type="number"
                value={(config.packageDiscounts.CAREER_BOOSTER * 100).toFixed(0)}
                onChange={(e) => updateDiscount('CAREER_BOOSTER', e.target.value)}
                className="w-full max-w-[200px] px-3 py-2 rounded border border-slate-200 text-sm focus:ring-[#B8935B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Premium Plus (%)</label>
              <input
                type="number"
                value={(config.packageDiscounts.PREMIUM_PLUS * 100).toFixed(0)}
                onChange={(e) => updateDiscount('PREMIUM_PLUS', e.target.value)}
                className="w-full max-w-[200px] px-3 py-2 rounded border border-slate-200 text-sm focus:ring-[#B8935B]"
              />
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
