'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { DEFAULT_PRICING } from '@/lib/pricing-v2';
import type { PricingConfig } from '@/lib/pricing-v2';

const TIERS = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'] as const;
const TIER_LABELS: Record<string, string> = {
  FRESHER: 'Fresher',
  MID_CAREER: 'Mid Career',
  EXECUTIVE: 'Executive',
  EXECUTIVE_PLUS: 'Exec Plus',
};
const SERVICES = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO', 'EXECUTIVE_CONNECT'] as const;
const SERVICE_LABELS: Record<string, string> = {
  RESUME: 'Resume',
  LINKEDIN: 'LinkedIn Profile',
  COVER_LETTER: 'Cover Letter',
  PORTFOLIO: 'Portfolio',
  EXECUTIVE_CONNECT: 'Executive Connect',
};

type CurrencyTab = 'INR' | 'USD';

export default function GlobalPricingPage() {
  const { isSuperAdmin } = useAdmin();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currencyTab, setCurrencyTab] = useState<CurrencyTab>('INR');

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
    } catch {
      alert('Error saving data');
    } finally {
      setSaving(false);
    }
  };

  const updateBasePrice = (currency: CurrencyTab, service: string, tier: string, value: string) => {
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
            [tier]: isNaN(num) ? 0 : num,
          },
        },
      },
    });
  };

  const updateDiscount = (pkg: string, value: string) => {
    if (!config) return;
    const num = parseFloat(value);
    setConfig({
      ...config,
      packageDiscounts: {
        ...config.packageDiscounts,
        [pkg]: isNaN(num) ? 0 : num / 100,
      },
    });
  };

  if (loading || !config) {
    return (
      <AppShell>
        <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 text-slate-400 text-sm animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-[#B8935B] animate-spin" />
            Loading pricing configuration…
          </div>
        </div>
      </AppShell>
    );
  }

  const symbol = currencyTab === 'INR' ? '₹' : '$';

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Revenue Engine &amp; Monetization</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Global Pricing Engine</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              Manage base prices for Indian clients (INR) and the Global anchor (USD) used to auto-convert for 180+ international currencies.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !isSuperAdmin}
            className="self-start sm:self-auto shrink-0 px-5 py-2.5 bg-[#B8935B] hover:bg-[#9A7540] text-white rounded-xl text-sm font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Saving…</span>
              </>
            ) : saveSuccess ? (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved!</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

        {/* ── Page-level nav (Base Pricing vs International Overrides) ── */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
          <Link
            href="/settings/global-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#B8935B] text-white shadow-xs whitespace-nowrap"
          >
            Base Pricing (INR &amp; USD)
          </Link>
          <Link
            href="/settings/international-pricing"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Fixed International Overrides
          </Link>
        </div>

        {/* ── Currency Tab Switcher ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-slate-200 px-1 pt-1">
            {(['INR', 'USD'] as CurrencyTab[]).map(cur => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrencyTab(cur)}
                className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 -mb-px border-b-2 ${
                  currencyTab === cur
                    ? 'text-[#B8935B] border-[#B8935B] bg-white'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black ${
                  cur === 'INR'
                    ? currencyTab === cur ? 'bg-[#FBF8F3] text-[#B8935B]' : 'bg-slate-100 text-slate-500'
                    : currencyTab === cur ? 'bg-[#FBF8F3] text-[#B8935B]' : 'bg-slate-100 text-slate-500'
                }`}>
                  {cur === 'INR' ? '₹' : '$'}
                </span>
                {cur === 'INR' ? 'Indian (INR)' : 'Global Anchor (USD)'}
              </button>
            ))}
          </div>

          {/* Tab description */}
          <div className="px-5 py-3 bg-[#FAF9F6] border-b border-slate-100">
            <p className="text-xs text-slate-500">
              {currencyTab === 'INR'
                ? 'Fixed standard prices charged to clients in India. These are applied directly without any FX conversion.'
                : 'USD anchor prices used as the baseline for all 180+ international currencies via live exchange rates (EUR, GBP, CAD, AED, SGD, etc.).'}
            </p>
          </div>

          {/* ── Desktop Table (≥ md) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-slate-700">Service</th>
                  {TIERS.map(t => (
                    <th key={t} className="px-4 py-3 text-center">
                      {TIER_LABELS[t]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SERVICES.map(svc => (
                  <tr key={`${currencyTab}-${svc}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 text-sm">
                      {SERVICE_LABELS[svc]}
                    </td>
                    {TIERS.map(tier => (
                      <td key={tier} className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-slate-400 font-medium text-sm">{symbol}</span>
                          <input
                            type="number"
                            // @ts-ignore
                            value={config.basePrices[currencyTab][svc]?.[tier] ?? 0}
                            onChange={(e) => updateBasePrice(currencyTab, svc, tier, e.target.value)}
                            min={0}
                            className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 transition-all"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card Grid (< md) ── */}
          <div className="block md:hidden divide-y divide-slate-100">
            {SERVICES.map(svc => (
              <div key={`${currencyTab}-${svc}`} className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
                  <span className="font-bold text-slate-900 text-sm">{SERVICE_LABELS[svc]}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {TIERS.map(tier => (
                    <div key={tier} className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {TIER_LABELS[tier]}
                      </label>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-[#B8935B] focus-within:ring-2 focus-within:ring-[#B8935B]/20 transition-all">
                        <span className="text-slate-400 text-xs font-medium">{symbol}</span>
                        <input
                          type="number"
                          // @ts-ignore
                          value={config.basePrices[currencyTab][svc]?.[tier] ?? 0}
                          onChange={(e) => updateBasePrice(currencyTab, svc, tier, e.target.value)}
                          min={0}
                          className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Package Discounts ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-[#FAF9F6] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center font-black text-sm">
              %
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Standard Package Discounts</h2>
              <p className="text-xs text-slate-400">Percentage discount applied to standard bundled packages (applies to both INR and USD).</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { key: 'CAREER_BOOSTER', label: 'Career Booster' },
              { key: 'PREMIUM_PLUS', label: 'Premium Plus' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-[#B8935B] focus-within:ring-2 focus-within:ring-[#B8935B]/20 transition-all">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={((config.packageDiscounts as any)[key] * 100).toFixed(0)}
                      onChange={(e) => updateDiscount(key, e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                      placeholder="0"
                    />
                    <span className="text-slate-400 font-bold text-sm ml-1">%</span>
                  </div>
                  <div className="px-3 py-2.5 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] text-xs font-bold min-w-[56px] text-center">
                    {((config.packageDiscounts as any)[key] * 100).toFixed(0)}% off
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Info Banner ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200/70 text-xs text-blue-800">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-blue-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div>
            <span className="font-bold">Zero-Loss Pricing Model:</span> The gateway fee is added on top of base prices so Catalyst retains 100% of the service fee. Clients absorb all transaction charges. Changes take effect immediately on new invoices. Existing invoices are unaffected.
          </div>
        </div>

      </div>
    </AppShell>
  );
}
