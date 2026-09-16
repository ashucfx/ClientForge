'use client';
import Link from 'next/link';
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
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Revenue Engine & Monetization</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Global Pricing Engine</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage base prices for Indian clients (INR) and the Global base (USD) used to auto-convert for 180+ international currencies.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !isSuperAdmin}
            className="self-start sm:self-auto px-4 py-2 bg-[#B8935B] hover:bg-[#9A7540] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? (
              <span>Saving…</span>
            ) : saveSuccess ? (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved Configuration</span>
              </>
            ) : (
              <span>Save Configuration</span>
            )}
          </button>
        </div>

        {/* ── Sub Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <Link
            href="/settings/global-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#B8935B] text-white shadow-xs"
          >
            Base Pricing (INR &amp; USD Anchor)
          </Link>
          <Link
            href="/settings/international-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Fixed International Overrides
          </Link>
        </div>

        {/* INR Base Prices */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-[#FAF9F6] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center font-bold text-xs">
              ₹
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Domestic Invoicing Base (INR)</h2>
              <p className="text-xs text-slate-400">Fixed standard prices charged to clients in India.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
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
                          <span className="text-slate-400 font-medium">₹</span>
                          <input
                            type="number"
                            // @ts-ignore
                            value={config.basePrices.INR[svc]?.[tier] ?? 0}
                            onChange={(e) => updateBasePrice('INR', svc, tier, e.target.value)}
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20"
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-[#FAF9F6] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center font-bold text-xs">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Global Invoicing Base (USD Anchor)</h2>
              <p className="text-xs text-slate-400">Serves as the global anchor. Auto-converted to 180+ local currencies (EUR, GBP, CAD, AED, etc.) at live rates.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
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
                          <span className="text-slate-400 font-medium">$</span>
                          <input
                            type="number"
                            // @ts-ignore
                            value={config.basePrices.USD[svc]?.[tier] ?? 0}
                            onChange={(e) => updateBasePrice('USD', svc, tier, e.target.value)}
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20"
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-[#FAF9F6] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center font-bold text-xs">
              %
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Standard Package Discounts</h2>
              <p className="text-xs text-slate-400">Percentage discount applied to standard bundled packages.</p>
            </div>
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
