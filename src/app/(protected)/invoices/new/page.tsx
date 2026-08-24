'use client';
// src/app/invoices/new/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { COUNTRIES, ISO2_TO_COUNTRY } from '@/lib/currency';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { CLIENT_TYPE_LABELS, FEE_RATES, round2 } from '@/lib/pricing';
import { DEFAULT_PRICING, PACKAGE_COMPLEMENTARY } from '@/lib/pricing-v2';
import type { ServiceSlug, PackageSlug, PricingConfig } from '@/lib/pricing-v2';
import { getCallingCodeForCountryName, normalizePhoneE164 } from '@/lib/phone';
import type { ClientType, LineItem, CurrencyInfo } from '@/types';
import { Logo } from '@/components/Logo';
import { IconAlert, IconCheck, IconChevronRight, IconCreditCard, IconDocument, IconLink, IconList, IconMail, IconRefresh, IconSettings, IconSpinner, IconTarget, IconUser, IconBuilding } from '@/components/Icons';
import AppShell from '@/components/AppShell';
import { format, addDays } from 'date-fns';
import { isRnModuleEnabledClient } from '@/lib/brand/flags';
import type { BrandId } from '@/lib/brand/types';
import { PAYPAL_SUPPORTED_CURRENCIES } from '@/lib/paypal-currencies';
import { useAdmin } from '@/components/AdminProvider';
import { useBrand } from '@/components/BrandProvider';

const CLIENT_TYPES: ClientType[] = ['FRESHER', 'MID_CAREER', 'EXECUTIVE', 'EXECUTIVE_PLUS'];

const CLIENT_META: Record<ClientType, { sub: string; color: string }> = {
  FRESHER:        { sub: 'Entry-level & graduates',  color: '#6366f1' },
  MID_CAREER:     { sub: '3–10 years experience',    color: '#ec4899' },
  EXECUTIVE:      { sub: '10+ yrs · Leadership',     color: '#f59e0b' },
  EXECUTIVE_PLUS: { sub: 'C-Suite & Board level',    color: '#B8935B' },
  AGENCY_CLIENT:  { sub: 'B2B Enterprise',           color: '#7C5CFF' },
};

// ─── Helpers ───────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function makeItem(description = '', qty = 1, unitPrice = 0): LineItem {
  return { id: uid(), description, qty, unitPrice, lineTotal: round2(qty * unitPrice) };
}

const PKG_SERVICES: Record<Exclude<PackageSlug, 'CUSTOM'>, ServiceSlug[]> = {
  CAREER_BOOSTER: ['RESUME', 'LINKEDIN', 'COVER_LETTER'],
  PREMIUM_PLUS:   ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'],
};

const SERVICE_LABELS: Record<ServiceSlug, string> = {
  RESUME:       'Professional Resume Writing',
  LINKEDIN:     'LinkedIn Profile Optimisation',
  COVER_LETTER: 'Cover Letter Writing',
  PORTFOLIO:    'Portfolio Website Development',
  EXECUTIVE_CONNECT: 'Executive Connect Strategy Consultation',
};

const PKG_META: Record<PackageSlug, { label: string; sub: string; color: string }> = {
  CAREER_BOOSTER: { label: 'Career Booster',  sub: 'Resume + LinkedIn + Cover Letter', color: '#B8935B' },
  PREMIUM_PLUS:   { label: 'Premium Plus',     sub: 'All four services',                color: '#8b5cf6' },
  CUSTOM:         { label: 'Custom',           sub: 'Build your own line items manually',         color: '#64748b' },
};

function defaultItemsForPackage(
  packageSlug: PackageSlug,
  clientType: ClientType,
  currencyCode: string,
  inrToLocalRate: number,  // INR → local (used when currencyCode === 'INR')
  usdToLocalRate: number,  // USD → local (used for all other currencies)
  pricingConfig: PricingConfig = DEFAULT_PRICING
): LineItem[] {
  if (packageSlug === 'CUSTOM') return [makeItem()];
  const isInr = currencyCode === 'INR';
  const baseCurrency: 'INR' | 'USD' = isInr ? 'INR' : 'USD';
  const convRate = isInr ? inrToLocalRate : usdToLocalRate;
  const complementarySet = new Set(PACKAGE_COMPLEMENTARY[packageSlug] ?? []);
  return PKG_SERVICES[packageSlug].map(slug => {
    const isComplimentary = complementarySet.has(slug);
    const basePrice = isComplimentary ? 0 : (pricingConfig.basePrices[baseCurrency][slug][clientType] ?? 0);
    const finalPrice = isInr ? basePrice : round2(basePrice * convRate);
    return makeItem(SERVICE_LABELS[slug] + (isComplimentary ? ' (Complimentary)' : ''), 1, finalPrice);
  });
}

// ─── Sub-components ────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.8px', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--blue)', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children, noPad }: { title: string; icon: React.ReactNode; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '13px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <span style={{
          width: 28, height: 28, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--brand-light)', borderRadius: 8, color: 'var(--brand)',
        }}>
          {icon}
        </span>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px' }}>{title}</h2>
      </div>
      <div style={noPad ? {} : { padding: '20px' }}>{children}</div>
    </div>
  );
}

// ─── Email Preview Pane ────────────────────────
function EmailPreviewPane({
  clientName, clientEmail, clientType, country, companyName,
  lineItems, discountRate, taxRate, notes, dueDays,
  currencyInfo, exchangeRate, usdExchangeRate, brandId,
  paymentGateway, paypalWillConvertToUsd,
}: {
  clientName: string; clientEmail: string; clientType: ClientType;
  country: string; companyName: string;
  lineItems: LineItem[]; discountRate: number; taxRate: number;
  notes: string; dueDays: number;
  currencyInfo: CurrencyInfo | null; exchangeRate: number; usdExchangeRate: number;
  brandId: BrandId; paymentGateway: 'RAZORPAY' | 'PAYPAL' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT'; paypalWillConvertToUsd: boolean;
}) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/invoices/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName, clientEmail, clientType, country, companyName,
          lineItems, discountRate, taxRate, notes, dueDays,
          currency:       currencyInfo?.code   ?? 'INR',
          currencySymbol: currencyInfo?.symbol ?? '₹',
          exchangeRate, usdExchangeRate, brandId,
          paymentGateway, paypalWillConvertToUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Preview failed');
      setHtml(data.html ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview error');
    } finally {
      setLoading(false);
    }
  }, [
    clientName, clientEmail, clientType, country, companyName,
    lineItems, discountRate, taxRate, notes, dueDays,
    currencyInfo, exchangeRate, usdExchangeRate, brandId,
    paymentGateway, paypalWillConvertToUsd,
  ]);

  // Fetch on first mount (key-based remount handles tab switching)
  useEffect(() => { fetchPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', background: '#fff', boxShadow: 'var(--shadow-lg)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 24, height: 24,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--brand-light)', borderRadius: 6, color: 'var(--brand)',
          }}>
            <IconMail size={13} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Email Preview</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
            background: loading ? '#fffbeb' : '#f0fdf4',
            color: loading ? '#92400e' : '#15803d',
            border: `1px solid ${loading ? '#fbbf2460' : '#bbf7d0'}`,
          }}>
            {loading ? 'Rendering…' : 'Ready'}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchPreview}
          disabled={loading}
          className="btn btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px', opacity: loading ? 0.4 : 1 }}
        >
          <IconRefresh size={13} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', minHeight: 360 }}>
        {loading && !html && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--muted)' }}>
            <span style={{ display: 'inline-flex', animation: 'spin 0.9s linear infinite', color: 'var(--brand)' }}>
              <IconSpinner size={22} />
            </span>
            <span style={{ fontSize: 13 }}>Rendering email template…</span>
          </div>
        )}
        {error && (
          <div style={{ padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fef2f2', borderBottom: '1px solid #fca5a5' }}>
            <IconAlert size={16} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#b91c1c' }}>{error}</span>
          </div>
        )}
        {html && (
          <iframe
            srcDoc={html}
            title="Email Preview"
            sandbox="allow-same-origin"
            style={{ width: '100%', height: 700, border: 'none', display: 'block' }}
          />
        )}
        {!html && !loading && !error && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Click <strong>Refresh</strong> to render the email preview.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block' }} />
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          Exact HTML sent via Resend · Pay Now button links to <code style={{ fontSize: 9 }}>#preview-pay</code>
        </span>
      </div>
    </div>
  );
}

// ─── Live Invoice Preview ──────────────────────
function InvoicePreview({
  clientName, clientEmail, clientType, country, companyName,
  lineItems, discountRate, taxRate, notes, dueDays,
  currencyInfo, exchangeRate, brandId,
  paypalWillConvertToUsd, usdExchangeRate,
  paymentGateway,
}: {
  clientName: string; clientEmail: string; clientType: ClientType;
  country: string; companyName: string;
  lineItems: LineItem[]; discountRate: number; taxRate: number;
  notes: string; dueDays: number;
  currencyInfo: CurrencyInfo | null; exchangeRate: number; brandId: BrandId;
  paypalWillConvertToUsd?: boolean; usdExchangeRate?: number;
  paymentGateway?: 'RAZORPAY' | 'PAYPAL' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT';
}) {
  const sym  = currencyInfo?.symbol ?? '₹';
  const code = currencyInfo?.code   ?? 'INR';

  const grossSubtotal   = round2(lineItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0));
  const discountAmount  = round2(grossSubtotal * discountRate / 100);
  const afterDiscount   = round2(grossSubtotal - discountAmount);
  const taxAmount       = round2(afterDiscount * taxRate / 100);
  const subtotal        = round2(afterDiscount + taxAmount);
  
  const gateway = paymentGateway ?? 'RAZORPAY';
  const feeRate = code === 'INR' 
    ? FEE_RATES.RAZORPAY_DOMESTIC 
    : (
        gateway === 'PAYPAL' ? FEE_RATES.PAYPAL_INTL :
        gateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' ? FEE_RATES.BANK_TRANSFER_NATIVE :
        gateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT' ? FEE_RATES.BANK_TRANSFER_SWIFT :
        FEE_RATES.RAZORPAY_INTL
      );
  
  // ZERO-LOSS GROSS-UP
  const total = round2(subtotal / (1 - feeRate));
  const fee   = round2(total - subtotal);
  const today           = new Date();
  const due             = addDays(today, dueDays);

  return (
    <div className="preview-card" style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', fontSize: 13 }}>
      {/* Header */}
      <div style={{ background: brandId === 'ripple_nexus' ? 'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)' : 'var(--brand-gradient)', padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Logo size={28} variant="horizontal" dark brandId={brandId} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Invoice</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginTop: 2 }}>PREVIEW</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
              {format(today, 'MMM dd, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Client info */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{clientName || '—'}</div>
            {companyName && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{companyName}</div>}
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{clientEmail || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{country || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 }}>Details</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {CLIENT_TYPE_LABELS[clientType]}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Due: {format(due, 'MMM dd, yyyy')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{code}</div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 2, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: 'var(--muted)' }}>Service</span>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: 'var(--muted)' }}>Amount ({code})</span>
        </div>
        {lineItems.map((item, i) => {
          const lt = round2(item.qty * item.unitPrice);
          const isFree = lt === 0;
          return (
            <div key={item.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: i < lineItems.length - 1 ? '1px solid #f1f5f9' : 'none', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, lineHeight: 1.4, wordBreak: 'break-word' as const }}>
                {item.description || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No description</span>}
                {item.qty !== 1 && <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>× {item.qty}</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: isFree ? '#16a34a' : 'var(--text)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                {isFree ? 'FREE' : fmt(lt, sym)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>Subtotal</span><span>{fmt(grossSubtotal, sym)}</span>
          </div>
          {discountRate > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16a34a' }}>
              <span>Discount ({discountRate}%)</span><span>−{fmt(discountAmount, sym)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
              <span>Tax ({taxRate}%)</span><span>+{fmt(taxAmount, sym)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', paddingTop: 5, borderTop: '1px dashed var(--border)' }}>
            <span>Processing Fee ({(feeRate * 100).toFixed(1)}%)</span><span>+{fmt(fee, sym)}</span>
          </div>
        </div>
        <div style={{ marginTop: 10, background: brandId === 'ripple_nexus' ? 'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)' : 'var(--brand-gradient)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}>Total Payable</span>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(total, sym)}</span>
        </div>
        {exchangeRate !== 1 && (
          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 7 }}>
            Exchange rate: 1 INR = {exchangeRate.toFixed(5)} {code}
          </div>
        )}
        {paypalWillConvertToUsd && usdExchangeRate && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fbbf2460' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>PayPal will charge in USD</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#78350f' }}>
              ≈ ${round2(total / usdExchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>
              {code} is not supported by PayPal — converted at today&apos;s rate
            </div>
          </div>
        )}
        {notes && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: 'var(--muted)', borderLeft: '3px solid var(--blue)' }}>
            <strong>Notes:</strong> {notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter();
  const { hasCatalystAccess, hasRnAccess, isSuperAdmin } = useAdmin();
  const { activeBrand } = useBrand();

  // Client fields
  const [rnEnabled,   setRnEnabled]   = useState(false);
  const [brandId,     setBrandId]     = useState<BrandId>(
    activeBrand === 'all' ? (hasCatalystAccess ? 'catalyst' : 'ripple_nexus') : activeBrand
  );
  const [clientName,  setClientName]  = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country,     setCountry]     = useState('India');
  const [clientType,   setClientType]   = useState<ClientType>('FRESHER');
  const [packageSlug,  setPackageSlug]  = useState<PackageSlug>('CAREER_BOOSTER');
  const [currencyOverride, setCurrencyOverride] = useState('');

  // Lead search combobox
  type LeadResult = { id: string; name: string; email: string | null; phone: string | null; companyName: string | null; country: string | null; displayId?: string | null; sourceType: string };
  const [leadQuery,    setLeadQuery]    = useState('');
  const [leadResults,  setLeadResults]  = useState<LeadResult[]>([]);
  const [leadLoading,  setLeadLoading]  = useState(false);
  const [leadOpen,     setLeadOpen]     = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadResult | null>(null);
  const leadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchLeads = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setLeadResults([]); setLeadOpen(false); return; }
    setLeadLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`/api/admin/contacts/search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: abortControllerRef.current.signal
      });
      const data = await res.json() as { results: LeadResult[] };
      setLeadResults(data.results ?? []);
      setLeadOpen((data.results ?? []).length > 0);
    } catch (err: any) { 
      if (err.name === 'AbortError') return; // ignore aborted fetches
    }
    finally { setLeadLoading(false); }
  }, []);

  const applyLead = (lead: LeadResult) => {
    setSelectedLead(lead);
    setLeadOpen(false);
    setLeadQuery('');
    if (lead.name)        setClientName(lead.name);
    if (lead.email)       setClientEmail(lead.email);
    if (lead.companyName) setCompanyName(lead.companyName);
    if (lead.country)     setCountry(lead.country);

    if (lead.phone) {
      const parsed = parsePhoneNumberFromString(lead.phone);
      if (parsed && parsed.country && ISO2_TO_COUNTRY[parsed.country]) {
        setCountry(ISO2_TO_COUNTRY[parsed.country]);
        setClientPhone(parsed.nationalNumber);
      } else {
        setClientPhone(lead.phone.replace(/^\+/, ''));
      }
    }
  };

  const clearLead = () => {
    setSelectedLead(null);
    setLeadQuery('');
    setLeadResults([]);
    setTimeout(() => leadInputRef.current?.focus(), 50);
  };

  // Invoice settings
  const [lineItems,       setLineItems]       = useState<LineItem[]>([]);
  const [discountRate,    setDiscountRate]    = useState(0);
  const [taxRate,         setTaxRate]         = useState(0);
  const [notes,           setNotes]           = useState('');
  const [dueDays,         setDueDays]         = useState(7);
  const [paymentGateway,  setPaymentGateway]  = useState<'RAZORPAY' | 'PAYPAL' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' | 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT'>('RAZORPAY');
  const [installmentCount, setInstallmentCount] = useState<1 | 2 | 3>(1);
  const [sourceChannel,   setSourceChannel]   = useState<'CLIENTFORGE_INVOICE' | 'MANUAL_PORTAL' | 'PAYMENT_GATEWAY_DIRECT' | 'CLIENT_REFERRAL'>('CLIENTFORGE_INVOICE');
  const [referralId,      setReferralId]      = useState('');
  const [referrerOptions, setReferrerOptions] = useState<{ id: string; name: string; email: string; referralCode?: string }[]>([]);

  useEffect(() => {
    fetch('/api/admin/referrals/options')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.options) setReferrerOptions(data.options);
      })
      .catch(() => {});
  }, []);

  // Currency state
  const [currencyInfo,    setCurrencyInfo]    = useState<CurrencyInfo | null>({ code: 'INR', symbol: '₹', name: 'Indian Rupee' });
  const [exchangeRate,    setExchangeRate]    = useState(1);   // INR → local
  const [usdExchangeRate, setUsdExchangeRate] = useState<number>(1);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);

  useEffect(() => {
    fetch('/api/public/pricing')
      .then(res => res.json())
      .then(data => setPricingConfig(data))
      .catch(console.error);
  }, []); // USD → local (≈ INR/USD fallback for IN)
  const [rateLoading,     setRateLoading]     = useState(false);

  // Ripple Nexus Services
  const [rnServices, setRnServices] = useState<{ id: string; name: string; slug: string; workflowStages: string[] }[]>([]);
  const [selectedRnServiceId, setSelectedRnServiceId] = useState<string>('');

  // UI state
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState('');
  const [toast,            setToast]            = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab,        setActiveTab]        = useState<'form' | 'invoice' | 'email'>('form');
  const [emailPreviewKey,  setEmailPreviewKey]  = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef   = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Fetch exchange rate when country or currency override changes
  const fetchRate = useCallback(async () => {
    if (!country) return;
    setRateLoading(true);
    try {
      const p = new URLSearchParams({ country });
      if (currencyOverride) p.set('currency', currencyOverride);
      const res  = await fetch(`/api/currency?${p}`);
      const data = await res.json();
      if (data.currency)     setCurrencyInfo(data.currency);
      if (data.exchangeRate) setExchangeRate(data.exchangeRate);
      if (data.usdRate)      setUsdExchangeRate(data.usdRate);
    } catch { /* silent */ }
    finally { setRateLoading(false); }
  }, [country, currencyOverride]);

  useEffect(() => {
    const t = setTimeout(fetchRate, 400);
    return () => clearTimeout(t);
  }, [fetchRate]);

  useEffect(() => {
    setRnEnabled(isRnModuleEnabledClient());
    if (isRnModuleEnabledClient()) {
      fetch('/api/rn/services').then(r => r.json()).then(d => {
        if (d.services) setRnServices(d.services);
      }).catch(console.error);
    }
  }, []);

  // Handle brand swap side effects
  useEffect(() => {
    if (brandId === 'ripple_nexus') {
      setClientType('AGENCY_CLIENT');
      setLineItems([makeItem('B2B Service / Retainer', 1, 0)]);
    } else {
      setClientType('FRESHER');
      setPackageSlug('CAREER_BOOSTER');
      setLineItems(defaultItemsForPackage('CAREER_BOOSTER', 'FRESHER', currencyInfo?.code ?? 'INR', exchangeRate, usdExchangeRate, pricingConfig));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  useEffect(() => {
    if (brandId === 'ripple_nexus' && selectedRnServiceId) {
      const srv = rnServices.find(s => s.id === selectedRnServiceId);
      if (srv && srv.workflowStages && srv.workflowStages.length > 0) {
        // Map B2B workflow stages into invoice milestones
        const items = srv.workflowStages.map((stage, idx) => 
          makeItem(`Milestone ${idx + 1}: ${stage.replace(/_/g, ' ')}`, 1, 0)
        );
        setLineItems(items);
      } else if (srv) {
        setLineItems([makeItem(`Service: ${srv.name}`, 1, 0)]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRnServiceId, brandId, rnServices]);

  // Re-populate default items when client type, package, or exchange rate changes
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
    }
    if (brandId !== 'catalyst') return;
    if (packageSlug === 'CUSTOM') return; // user is building manually
    setLineItems(defaultItemsForPackage(packageSlug, clientType, currencyInfo?.code ?? 'INR', exchangeRate, usdExchangeRate, pricingConfig));
    // Discount is now entirely manual based on user request
    setDiscountRate(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientType, packageSlug, exchangeRate]);

  // ── Line item helpers ──
  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.lineTotal = round2(Number(updated.qty) * Number(updated.unitPrice));
      return updated;
    }));
  };

  const addItem = () => setLineItems(prev => [...prev, makeItem()]);
  const removeItem = (id: string) => setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim() || !country) {
      setError('Please fill in all required fields (Name, Email, Phone, Country).');
      return;
    }

    const normalizedPhone = normalizePhoneE164(clientPhone, country);
    if (!normalizedPhone) {
      setError('Invalid phone number. Select the correct country and enter a valid mobile number (or include +country code).');
      return;
    }

    const validItems = lineItems.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setError('Add at least one line item with a description.');
      return;
    }
    const grossTotal = validItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0);
    if (grossTotal <= 0) {
      setError('Invoice total must be greater than zero. At least one item must have a price.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const effectiveCurrency = currencyOverride.trim() || currencyInfo?.code || 'INR';
      const res = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: normalizedPhone.e164,
          companyName: companyName.trim() || undefined,
          country,
          clientType,
          brandId,
          rnServiceId: brandId === 'ripple_nexus' ? selectedRnServiceId : undefined,
          currencyOverride: currencyOverride.trim() || undefined,
          // INR always uses Razorpay (enforced server-side too)
          paymentGateway: effectiveCurrency === 'INR' ? 'RAZORPAY' : paymentGateway,
          installmentCount,
          sourceChannel: referralId.trim() ? 'CLIENT_REFERRAL' : 'CLIENTFORGE_INVOICE',
          referralId: referralId.trim() || undefined,
          lineItems: validItems,
          discountRate,
          taxRate,
          notes: notes.trim() || undefined,
          dueDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Invoice creation failed');
      }
      showToast('Invoice created & payment link sent!');
      setTimeout(() => router.push(`/invoices/${data.invoice.id}?created=true`), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      setSubmitting(false);
      // Scroll to error so it's visible
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  };

  const sym = currencyInfo?.symbol ?? '₹';
  const callingCode = getCallingCodeForCountryName(country);
  const phonePreview = clientPhone.trim() ? normalizePhoneE164(clientPhone, country) : null;

  // PayPal converts unsupported currencies to USD — warn admin before they submit
  const localCode = currencyInfo?.code ?? 'INR';
  const paypalWillConvertToUsd = paymentGateway === 'PAYPAL' && localCode !== 'USD' && !PAYPAL_SUPPORTED_CURRENCIES.has(localCode);

  // Live calculations for the Form tab
  const formGrossSubtotal = round2(lineItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0));
  const formDiscountAmount = round2(formGrossSubtotal * discountRate / 100);
  const formAfterDiscount = round2(formGrossSubtotal - formDiscountAmount);
  const formTaxAmount = round2(formAfterDiscount * taxRate / 100);
  const formSubtotal = round2(formAfterDiscount + formTaxAmount);
  const formFeeRate = localCode === 'INR'
    ? FEE_RATES.RAZORPAY_DOMESTIC
    : (
        paymentGateway === 'PAYPAL' ? FEE_RATES.PAYPAL_INTL :
        paymentGateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' ? FEE_RATES.BANK_TRANSFER_NATIVE :
        paymentGateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT' ? FEE_RATES.BANK_TRANSFER_SWIFT :
        FEE_RATES.RAZORPAY_INTL
      );
  const formTotalPayable = round2(formSubtotal / (1 - formFeeRate));
  const formProcessingFee = round2(formTotalPayable - formSubtotal);

  return (
    <AppShell>
      <main className="page-body">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color .15s' }}>Dashboard</Link>
            <IconChevronRight size={12} style={{ opacity: 0.5 }} />
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>New Invoice</span>
          </div>

          {/* Title + live status chips */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                Create Invoice
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Fill details · preview · send the payment link
              </p>
            </div>

            {/* Live chips — update as admin fills the form */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, paddingTop: 2 }}>
              {/* Brand */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: 'var(--brand-light)', border: '1px solid rgba(184,147,91,.28)',
                fontSize: 11, fontWeight: 700, color: 'var(--brand)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
                {brandId === 'catalyst' ? 'Catalyst' : 'Ripple Nexus'}
              </span>

              {/* Currency */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: '#f0f9ff', border: '1px solid #bae6fd',
                fontSize: 11, fontWeight: 700, color: '#0369a1',
              }}>
                {rateLoading
                  ? <><IconSpinner size={10} style={{ animation: 'spin .9s linear infinite' }} /> Fetching…</>
                  : <>{currencyInfo?.symbol ?? '₹'} {localCode}</>}
              </span>

              {/* Gateway */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: paypalWillConvertToUsd ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${paypalWillConvertToUsd ? 'rgba(251,191,36,.5)' : '#bbf7d0'}`,
                fontSize: 11, fontWeight: 700,
                color: paypalWillConvertToUsd ? '#92400e' : '#15803d',
              }}>
                <IconCreditCard size={10} />
                {localCode === 'INR' || paymentGateway === 'RAZORPAY' ? 'Razorpay' : 
                 paymentGateway === 'PAYPAL' ? 'PayPal' : 
                 paymentGateway === 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' ? 'Bank Transfer (Native)' : 'Bank Transfer (SWIFT)'}
                {paypalWillConvertToUsd && <span style={{ marginLeft: 2 }}>→ USD</span>}
              </span>
            </div>
          </div>
        </div>

        {/* ── Page tab navigation ── */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 28,
          background: 'var(--surface-2)',
          borderRadius: 14, padding: 4,
          border: '1px solid rgba(184,147,91,.18)',
          overflowX: 'auto' as const,
        }}>
          {([
            { key: 'form'    as const, label: 'Details & Items', Icon: IconList     },
            { key: 'invoice' as const, label: 'Invoice Preview',  Icon: IconDocument },
            { key: 'email'   as const, label: 'Email Preview',    Icon: IconMail     },
          ] as const).map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'email') setEmailPreviewKey(k => k + 1);
                }}
                style={{
                  flex: 1, padding: '10px 14px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all .15s',
                  background: active ? '#fff' : 'transparent',
                  color: active ? 'var(--brand)' : 'var(--text-tertiary)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 13,
                  boxShadow: active ? '0 1px 6px rgba(184,147,91,.2), 0 1px 2px rgba(0,0,0,.06)' : 'none',
                  borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                <tab.Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Form tab ── */}
        {activeTab === 'form' && (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
            {rnEnabled && (hasCatalystAccess && hasRnAccess) && (
              <SectionCard title="Brand & Operational Unit" icon={<IconBuilding />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setBrandId('catalyst')}
                    style={{
                      border: `2px solid ${brandId === 'catalyst' ? 'var(--brand)' : 'var(--border)'}`,
                      background: brandId === 'catalyst' ? 'var(--surface-2)' : '#fff',
                      borderRadius: 12, padding: '14px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: brandId === 'catalyst' ? 'var(--brand)' : 'var(--text)' }}>
                        Catalyst
                      </span>
                      {brandId === 'catalyst' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Career Booster Services</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrandId('ripple_nexus')}
                    style={{
                      border: `2px solid ${brandId === 'ripple_nexus' ? '#7C5CFF' : 'var(--border)'}`,
                      background: brandId === 'ripple_nexus' ? '#f3f0ff' : '#fff',
                      borderRadius: 12, padding: '14px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: brandId === 'ripple_nexus' ? '#7C5CFF' : 'var(--text)' }}>
                        Ripple Nexus
                      </span>
                      {brandId === 'ripple_nexus' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C5CFF' }} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>B2B Agency & Software</div>
                  </button>
                </div>
              </SectionCard>
            )}

            {/* 1. Client Info */}
            <SectionCard title="Client Information" icon={<IconUser />}>

              {/* ── Lead Search Combobox ─────────────────────────────────── */}
              <div style={{ marginBottom: 18, position: 'relative' as const }}>
                <FieldLabel label="Search existing lead / client" />
                {selectedLead ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--brand)',
                    background: 'var(--brand-light)', gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedLead.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {selectedLead.email}{selectedLead.companyName ? ` · ${selectedLead.companyName}` : ''}{selectedLead.displayId ? ` · ${selectedLead.displayId}` : ''}
                      </div>
                    </div>
                    <button type="button" onClick={clearLead}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '2px 6px', borderRadius: 6 }}
                      title="Clear selected lead"
                    >✕ Change</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' as const }}>
                    <input
                      ref={leadInputRef}
                      className="input"
                      type="text"
                      value={leadQuery}
                      placeholder="Search by name, email, phone or ID…"
                      autoComplete="off"
                      onChange={e => {
                        const v = e.target.value;
                        setLeadQuery(v);
                        if (leadDebounce.current) clearTimeout(leadDebounce.current);
                        leadDebounce.current = setTimeout(() => searchLeads(v), 300);
                      }}
                      onFocus={() => { if (leadResults.length > 0) setLeadOpen(true); }}
                      onBlur={() => setTimeout(() => setLeadOpen(false), 150)}
                    />
                    {leadLoading && (
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin .9s linear infinite', display: 'inline-flex', color: 'var(--brand)', fontSize: 14 }}>⟳</span>
                    )}
                    {leadOpen && leadResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                        background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
                      }}>
                        {leadResults.map((lead, idx) => (
                          <div
                            key={lead.id}
                            onMouseDown={() => applyLead(lead)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', borderBottom: idx < leadResults.length - 1 ? '1px solid var(--border)' : 'none',
                              transition: 'background .1s',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--brand-light)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{lead.name}</div>
                              <div style={{ fontSize: 11, color: '#475569', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {lead.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>📧 {lead.email}</span>}
                                {lead.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: '#0284c7' }}>📞 {lead.phone}</span>}
                                {lead.companyName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>🏢 {lead.companyName}</span>}
                                {lead.country && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: '#059669' }}>📍 {lead.country}</span>}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                              background: lead.sourceType === 'contact' ? '#e0f2fe' : lead.sourceType === 'career_client' ? '#fef3c7' : '#f3e8ff',
                              color: lead.sourceType === 'contact' ? '#0369a1' : lead.sourceType === 'career_client' ? '#92400e' : '#6b21a8',
                              border: '1px solid currentColor', textTransform: 'uppercase' as const, letterSpacing: '0.4px', flexShrink: 0,
                            }}>{lead.sourceType === 'contact' ? 'Contact Registry' : lead.sourceType === 'career_client' ? 'Career Client' : 'RN Client'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  Optional — select an existing client to auto-fill the fields below
                </div>
              </div>
              {/* ─────────────────────────────────────────────────────────── */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel label="Full Name" required />
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                  />
                </div>
                <div>
                  <FieldLabel label="Email Address" required />
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="priya@example.com"
                  />
                </div>
                <div>
                  <FieldLabel label="Phone Number" required />
                  <div className="flex gap-2">
                    <div
                      className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-black flex items-center justify-center shrink-0 min-w-[70px] shadow-xs"
                      aria-label="Country calling code"
                      title="Country calling code (based on selected country)"
                    >
                      {callingCode ? `+${callingCode}` : '—'}
                    </div>
                    <input
                      className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                      type="tel"
                      inputMode="tel"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      placeholder={country === 'India' ? '9876543210' : '4155552671 (or +code)'}
                    />
                  </div>
                  <div className="mt-1.5 text-xs">
                    {clientPhone.trim() ? (
                      phonePreview ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-[11px]">
                          <span>✓</span>
                          <span>Format: {phonePreview.e164}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold text-[11px]">
                          <span>⚠</span>
                          <span>Invalid phone number for {country || 'selected country'}</span>
                        </div>
                      )
                    ) : (
                      <span className="text-slate-400 text-[11px]">Enter mobile number for payment link SMS &amp; updates</span>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel label="Company / Organisation (optional)" />
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Google Inc."
                  />
                </div>
                <div>
                  <FieldLabel label="Country" required />
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                    value={country}
                    onChange={e => { setCountry(e.target.value); setCurrencyOverride(''); }}
                  >
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel label="Currency Override (optional)" />
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                    type="text"
                    value={currencyOverride}
                    onChange={e => setCurrencyOverride(e.target.value.toUpperCase())}
                    placeholder={rateLoading ? 'Fetching…' : `Auto: ${currencyInfo?.code ?? 'INR'}`}
                    maxLength={3}
                  />
                </div>

                {/* Referral Mapping */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isReferral"
                        checked={Boolean(referralId)}
                        onChange={e => {
                          if (!e.target.checked) setReferralId('');
                          else setReferralId(referrerOptions[0]?.referralCode || referrerOptions[0]?.name || 'Referred Client');
                        }}
                        className="w-4 h-4 text-[#B8935B] rounded border-slate-300 focus:ring-[#B8935B] cursor-pointer"
                      />
                      <label htmlFor="isReferral" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        Referred by Existing Client (Optional)
                      </label>
                    </div>
                    {referralId && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Referral Mapped
                      </span>
                    )}
                  </div>

                  {Boolean(referralId) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 bg-[#FBF8F3] p-3.5 rounded-2xl border border-[#B8935B]/30 animate-fadeIn">
                      <div>
                        <FieldLabel label="Select Referring Client" />
                        <select
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                          value={referrerOptions.some(o => o.referralCode === referralId || o.name === referralId) ? referralId : ''}
                          onChange={e => setReferralId(e.target.value)}
                        >
                          <option value="">Choose from existing clients…</option>
                          {referrerOptions.map(opt => (
                            <option key={opt.id} value={opt.referralCode || opt.name}>
                              {opt.name} {opt.referralCode ? `(${opt.referralCode})` : `(${opt.email})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel label="Or Custom Referral Code / Name" />
                        <input
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white transition-all shadow-xs"
                          type="text"
                          value={referralId}
                          onChange={e => setReferralId(e.target.value)}
                          placeholder="e.g. REF-ABC123 or Client Name"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* 2. Career Level (Catalyst Only) */}
            {brandId === 'catalyst' && (
              <SectionCard title="Career Level" icon={<IconTarget />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
                  {CLIENT_TYPES.map(t => {
                    const meta = CLIENT_META[t];
                    const sel  = clientType === t;
                    const isInr = (currencyInfo?.code ?? 'INR') === 'INR';
                    const baseCur = isInr ? 'INR' : 'USD';
                    const resumeBase = pricingConfig.basePrices[baseCur].RESUME[t] ?? 0;
                    const linkedinBase = pricingConfig.basePrices[baseCur].LINKEDIN[t] ?? 0;
                    const baseSum = resumeBase + linkedinBase;
                    const displayPrice = isInr ? baseSum : round2(baseSum * usdExchangeRate);
                    const fromLabel = isInr
                      ? `from ${sym}${displayPrice.toLocaleString('en-IN')}`
                      : `from ${fmt(displayPrice, sym)}${currencyInfo?.code ? ` ${currencyInfo.code}` : ''}`;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setClientType(t)}
                        style={{
                          border: `2px solid ${sel ? meta.color : 'var(--border)'}`,
                          background: sel ? `${meta.color}12` : '#fff',
                          borderRadius: 12, padding: '14px', cursor: 'pointer',
                          textAlign: 'left', transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: sel ? meta.color : 'var(--text)' }}>
                            {CLIENT_TYPE_LABELS[t]}
                          </span>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? meta.color : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{meta.sub}</div>
                        <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, marginTop: 6 }}>
                          {fromLabel}{exchangeRate !== 1 ? ' (auto)' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* 2b. Package Selector (Catalyst Only) */}
            {brandId === 'catalyst' && (
              <SectionCard title="Package" icon={<IconList />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
                  {(Object.keys(PKG_META) as PackageSlug[]).map(pkg => {
                    const meta = PKG_META[pkg];
                    const sel  = packageSlug === pkg;
                    return (
                      <button
                        key={pkg}
                        type="button"
                        onClick={() => setPackageSlug(pkg)}
                        style={{
                          border: `2px solid ${sel ? meta.color : 'var(--border)'}`,
                          background: sel ? `${meta.color}10` : '#fff',
                          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                          textAlign: 'left', transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: sel ? meta.color : 'var(--text)' }}>
                            {meta.label}
                          </span>
                          {sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{meta.sub}</div>
                      </button>
                    );
                  })}
                </div>
                {packageSlug === 'CUSTOM' && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #64748b' }}>
                    Custom mode — add or edit line items freely below.
                  </div>
                )}
              </SectionCard>
            )}

            {/* 2c. B2B Service (Ripple Nexus Only) */}
            {brandId === 'ripple_nexus' && (
              <SectionCard title="B2B Service" icon={<IconTarget />}>
                <FieldLabel label="Select Service Module" required />
                <select 
                  className="input" 
                  value={selectedRnServiceId} 
                  onChange={e => setSelectedRnServiceId(e.target.value)}
                  style={{ marginBottom: 12 }}
                >
                  <option value="">-- Custom / Other --</option>
                  {rnServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Selecting a service module automatically links this invoice to the Ripple Nexus service pipeline upon payment.
                </div>
              </SectionCard>
            )}

            {/* 3. Line Items */}
            <SectionCard title="Line Items" icon={<IconList />} noPad>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 70 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 130 }}>Unit Price ({sym})</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', borderBottom: '1px solid var(--border)', width: 120 }}>Total</th>
                      <th style={{ width: 40, borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const lt = round2(item.qty * item.unitPrice);
                      return (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 10px', fontSize: 13 }}
                              type="text"
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Service description…"
                            />
                          </td>
                          <td style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 6px', fontSize: 13, textAlign: 'center', width: '100%' }}
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.qty}
                              onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                            <input
                              className="input"
                              style={{ margin: 0, padding: '7px 10px', fontSize: 13, textAlign: 'right', width: '100%' }}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, fontSize: 13, color: lt === 0 ? '#16a34a' : 'var(--text)', whiteSpace: 'nowrap' }}>
                            {lt === 0 ? 'FREE' : fmt(lt, sym)}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={lineItems.length === 1}
                              style={{ border: 'none', background: 'transparent', cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer', color: '#dc2626', opacity: lineItems.length === 1 ? 0.3 : 1, fontSize: 16, lineHeight: 1, padding: 4 }}
                              title="Remove row"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, padding: '8px 14px' }}
                >
                  + Add Item
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Items Subtotal:</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{fmt(formGrossSubtotal, sym)}</span>
                </div>
              </div>
            </SectionCard>

            {/* 4. Adjustments */}
            <SectionCard title="Invoice Settings" icon={<IconSettings />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <FieldLabel label="Discount %" />
                  <input
                    className="input"
                    type="number" min="0" max="100" step="0.5"
                    value={discountRate}
                    onChange={e => setDiscountRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel label="Tax %" />
                  <input
                    className="input"
                    type="number" min="0" max="100" step="0.5"
                    value={taxRate}
                    onChange={e => setTaxRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel label="Due In (days)" />
                  <input
                    className="input"
                    type="number" min="1" max="90" step="1"
                    value={dueDays}
                    onChange={e => setDueDays(Math.min(90, Math.max(1, parseInt(e.target.value) || 7)))}
                    placeholder="7"
                  />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <FieldLabel label="Notes (optional)" />
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes for the client…"
                  style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
                />
              </div>

              {/* Live Cost & Fee Summary Banner directly in form */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--muted)', marginBottom: 10 }}>
                  Estimated Invoice Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Subtotal</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(formGrossSubtotal, sym)}</div>
                  </div>
                  {formDiscountAmount > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Discount ({discountRate}%)</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>-{fmt(formDiscountAmount, sym)}</div>
                    </div>
                  )}
                  {formTaxAmount > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Tax ({taxRate}%)</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>+{fmt(formTaxAmount, sym)}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>Fee ({(formFeeRate * 100).toFixed(2)}%)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>+{fmt(formProcessingFee, sym)}</div>
                  </div>
                  <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 800 }}>Total Payable</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>{fmt(formTotalPayable, sym)}</div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 5. Payment Gateway — always accessible */}
            <SectionCard title="Payment Gateway" icon={<IconCreditCard />}>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Choose your checkout provider. Razorpay handles domestic UPI, cards &amp; international multi-currency. PayPal handles global cards &amp; wallets.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
                {([
                  {
                    value: 'RAZORPAY' as const,
                    label: 'Razorpay Instant Link',
                    sub: 'Cards, UPI & Multi-currency Checkout',
                    fee: 'Standard Gateway Link',
                    color: '#B8935B',
                    badge: 'Instant Links',
                  },
                  {
                    value: 'PAYPAL' as const,
                    label: 'PayPal Invoice',
                    sub: 'Global PayPal & Cards (USD)',
                    fee: 'Global Checkout',
                    color: '#003087',
                    badge: 'International',
                  },
                  {
                    value: 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_NATIVE' as const,
                    label: 'Bank Transfer (Native Rails)',
                    sub: 'ACH (US), SEPA (EU), BACS/FPS (UK), etc.',
                    fee: '1.18% Fee (1% + 18% GST)',
                    color: '#059669',
                    badge: 'Lowest Fee (1.18%)',
                  },
                  {
                    value: 'RAZORPAY_INTERNATIONAL_BANK_TRANSFER_SWIFT' as const,
                    label: 'Bank Transfer (Global SWIFT)',
                    sub: 'International Wire Transfer via SWIFT',
                    fee: '3.54% Fee (3% + 18% GST)',
                    color: '#0284c7',
                    badge: 'Global Wire (3.54%)',
                  },
                ] as const).map(opt => {
                  const sel = paymentGateway === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentGateway(opt.value)}
                      style={{
                        border: `2px solid ${sel ? opt.color : 'var(--border)'}`,
                        background: sel ? `${opt.color}12` : '#fff',
                        borderRadius: 12, padding: '14px 16px',
                        cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        touchAction: 'manipulation',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          {opt.badge ? (
                            <span style={{
                              background: sel ? opt.color : '#f1f5f9',
                              color: sel ? '#fff' : '#475569',
                              fontSize: 10, fontWeight: 700, borderRadius: 20,
                              padding: '2px 8px', letterSpacing: '.3px',
                            }}>
                              {opt.badge}
                            </span>
                          ) : <span />}
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? opt.color : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: sel ? opt.color : 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.4 }}>{opt.sub}</div>
                      </div>
                      <div style={{ fontSize: 11, color: opt.color, fontWeight: 700, marginTop: 4 }}>{opt.fee}</div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* PayPal unsupported currency warning */}
            {paypalWillConvertToUsd && (
              <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    PayPal doesn&apos;t support {localCode} natively
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    The invoice will be <strong>created and charged in USD</strong> via PayPal.
                    The client email will show the USD amount with an approximate {localCode} reference below it.
                    The preview on the right shows your entered {localCode} prices — after creation, the admin dashboard and email will reflect the converted USD amount.
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', marginTop: 6 }}>
                    If you want to charge in {localCode} directly, <strong>switch to Razorpay</strong> — it supports multi-currency natively.
                  </div>
                </div>
              </div>
            )}

            {/* 6. Split Payment */}
            <SectionCard title="Payment Structure" icon={<IconCreditCard />}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Split the total into equal instalments. Each part gets its own payment link sent to the client.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
                {([
                  { value: 1 as const, label: 'Full Payment',       sub: 'Single link',           badge: null },
                  { value: 2 as const, label: 'Split in 2 Parts',   sub: '50% + 50%',             badge: 'Popular' },
                  { value: 3 as const, label: 'Split in 3 Parts',   sub: '33% + 33% + 34%',       badge: null },
                ] as const).map(opt => {
                  const sel = installmentCount === opt.value;
                  const color = sel ? '#2B5CE6' : 'var(--border)';
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInstallmentCount(opt.value)}
                      style={{
                        border: `2px solid ${sel ? '#2B5CE6' : 'var(--border)'}`,
                        background: sel ? '#eef2ff' : '#fff',
                        borderRadius: 12, padding: '12px 14px',
                        cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                        position: 'relative',
                      }}
                    >
                      {opt.badge && (
                        <span style={{ position: 'absolute', top: 7, right: 7, background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 6px' }}>
                          {opt.badge}
                        </span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 800, color: sel ? '#2B5CE6' : 'var(--text)', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{opt.sub}</div>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${sel ? '#2B5CE6' : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                        {sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2B5CE6' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {installmentCount > 1 && (() => {
                const effectiveCurrency = currencyOverride.trim() || currencyInfo?.code || 'INR';
                const sym = currencyInfo?.symbol ?? '$';
                const grossSubtotal = lineItems.reduce((s, i) => s + round2(i.qty * i.unitPrice), 0);
                const fee = round2(grossSubtotal * (effectiveCurrency === 'INR' ? 0.02 : 0.035));
                const total = round2(grossSubtotal + fee);
                const slice = round2(Math.floor((total / installmentCount) * 100) / 100);
                const parts = Array.from({ length: installmentCount }, (_, i) =>
                  i === installmentCount - 1 ? round2(total - slice * (installmentCount - 1)) : slice
                );
                return (
                  <div style={{ marginTop: 14, background: '#f5f8ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #dce6ff' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Instalment Breakdown</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {parts.map((amt, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ color: 'var(--text)' }}>Part {i + 1} — due in ~{Math.round(dueDays * ((i + 1) / installmentCount))} days</span>
                          <span style={{ fontWeight: 700, color: '#2B5CE6' }}>{sym}{amt.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                      Each part gets its own payment link. Client pays them independently.
                    </div>
                  </div>
                );
              })()}
            </SectionCard>

            {/* Error */}
            {error && (
              <div ref={errorRef} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 16px', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', marginTop: 1 }}>
                    <IconAlert size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                      {error.startsWith('Payment link creation failed')
                        ? (error.includes('(PAYPAL)') ? 'PayPal Payment Link Error' : 'Razorpay Payment Link Error')
                        : 'Error'}
                    </div>
                    <div style={{ color: '#b91c1c', lineHeight: 1.55 }}>{error}</div>
                    {error.includes('(PAYPAL)') && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d', background: '#fee2e2', borderRadius: 8, padding: '8px 10px' }}>
                        <strong>Check:</strong> PayPal Client ID &amp; Secret in env vars (must be different values) · PAYPAL_ENV matches your app type (sandbox vs production) · App has Invoicing permission enabled
                      </div>
                    )}
                    {error.includes('Razorpay') && !error.includes('(PAYPAL)') && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d', background: '#fee2e2', borderRadius: 8, padding: '8px 10px' }}>
                        <strong>Check:</strong> Razorpay API keys in Vercel env vars · Account enabled for this currency · Phone number is valid
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '15px 20px', fontSize: 15, fontWeight: 700, borderRadius: 12, gap: 10 }}
              >
                {submitting ? (
                  <>
                    <span style={{ display: 'inline-flex', animation: 'spin 0.9s linear infinite' }}>
                      <IconSpinner size={17} />
                    </span>
                    Creating invoice…
                  </>
                ) : (
                  <>
                    <IconMail size={17} />
                    Create Invoice &amp; Send Email
                  </>
                )}
              </button>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' as const }}>
                {([
                  [<IconCheck key="a" size={11} />, 'Secure payment link'],
                  [<IconMail  key="b" size={11} />, 'Branded email sent'],
                  [<IconLink  key="c" size={11} />, 'Auto-tracks payment'],
                ] as const).map(([icon, label], i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--brand)' }}>{icon}</span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Invoice Preview tab ── */}
        {activeTab === 'invoice' && (
          <div style={{ maxWidth: 580, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 30, height: 30,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--brand-light)', borderRadius: 8, color: 'var(--brand)',
                }}>
                  <IconDocument size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {clientName || 'Invoice Preview'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Live — updates as you fill the form
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setActiveTab('form')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px', flexShrink: 0 }}
              >
                <IconChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
                Back to Form
              </button>
            </div>
            <InvoicePreview
              clientName={clientName}
              clientEmail={clientEmail}
              clientType={clientType}
              country={country}
              companyName={companyName}
              lineItems={lineItems}
              discountRate={discountRate}
              taxRate={taxRate}
              notes={notes}
              dueDays={dueDays}
              currencyInfo={currencyInfo}
              exchangeRate={exchangeRate}
              brandId={brandId}
              paypalWillConvertToUsd={paypalWillConvertToUsd}
              usdExchangeRate={usdExchangeRate}
              paymentGateway={paymentGateway}
            />
          </div>
        )}

        {/* ── Email Preview tab ── */}
        {activeTab === 'email' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 30, height: 30,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--brand-light)', borderRadius: 8, color: 'var(--brand)',
                }}>
                  <IconMail size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Email Preview</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Exact HTML sent to {clientEmail || 'client'} via Resend
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setActiveTab('form')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px', flexShrink: 0 }}
              >
                <IconChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
                Back to Form
              </button>
            </div>
            <EmailPreviewPane
              key={emailPreviewKey}
              clientName={clientName}
              clientEmail={clientEmail}
              clientType={clientType}
              country={country}
              companyName={companyName}
              lineItems={lineItems}
              discountRate={discountRate}
              taxRate={taxRate}
              notes={notes}
              dueDays={dueDays}
              currencyInfo={currencyInfo}
              exchangeRate={exchangeRate}
              usdExchangeRate={usdExchangeRate}
              brandId={brandId}
              paymentGateway={paymentGateway}
              paypalWillConvertToUsd={paypalWillConvertToUsd}
            />
          </div>
        )}
      </main>

      {toast && (
        <div className="toast-stack">
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            <span>{toast.type === 'error' ? '✕' : '✓'}</span>
            {toast.msg}
          </div>
        </div>
      )}
    </AppShell>
  );
}
