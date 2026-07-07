'use client';

import React, { useState, useRef, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, Loader2, Lock, Star } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SELF_SERVICE_PACKAGES } from '@/lib/catalog/self-service';
import { PRICING, PACKAGE_COMPLEMENTARY } from '@/lib/pricing-v2';
import type { ServiceSlug, PackageSlug as PkgSlug } from '@/lib/pricing-v2';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

type PackageSlug = 'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM';

type ExperienceKey = 'FRESHER' | 'MID_CAREER' | 'EXECUTIVE' | 'EXECUTIVE_PLUS';

const SERVICE_LABELS: Record<ServiceSlug, string> = {
  RESUME:       'Resume Writing',
  LINKEDIN:     'LinkedIn Optimisation',
  COVER_LETTER: 'Cover Letter',
  PORTFOLIO:    'Portfolio Website',
};

const PKG_SERVICES: Record<Exclude<PackageSlug, 'CUSTOM'>, ServiceSlug[]> = {
  CAREER_BOOSTER: ['RESUME', 'LINKEDIN', 'COVER_LETTER'],
  PREMIUM_PLUS:   ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'],
};

function computePrice(
  pkg: PackageSlug,
  tier: ExperienceKey,
  cur: 'INR' | 'USD',
  customSlugs: string[] = [],
) {
  const prices = PRICING.basePrices[cur];
  const sym    = cur === 'INR' ? '₹' : '$';
  const slugs: ServiceSlug[] =
    pkg === 'CUSTOM'
      ? (customSlugs as ServiceSlug[]).filter(s => s in prices)
      : PKG_SERVICES[pkg] ?? [];

  const complementarySet = new Set(PACKAGE_COMPLEMENTARY[pkg as PkgSlug] ?? []);
  const services = slugs.map(slug => ({
    slug,
    label: SERVICE_LABELS[slug],
    price: complementarySet.has(slug) ? 0 : (prices[slug]?.[tier] ?? 0),
    complimentary: complementarySet.has(slug),
  }));
  const subtotal  = services.reduce((s, x) => s + x.price, 0);
  const rate      = PRICING.packageDiscounts[pkg as PkgSlug] ?? 0;
  // Match server rounding: whole units for INR, cents for USD
  const discount  = cur === 'INR'
    ? Math.round(subtotal * rate)
    : Math.round(subtotal * rate * 100) / 100;
  return { sym, services, subtotal, discount, total: subtotal - discount, rate };
}

export default function CatalystCheckoutPage() {
  return (
    <Suspense>
      <CheckoutPageInner />
    </Suspense>
  );
}

function detectCountry(): { code: string; name: string; phone: string } {
  if (typeof window === 'undefined') return { code: 'IN', name: 'India', phone: 'in' };
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Calcutta' || tz === 'Asia/Kolkata') return { code: 'IN', name: 'India', phone: 'in' };
  } catch {}
  return { code: 'US', name: 'United States', phone: 'us' };
}

const INITIAL_COUNTRY = detectCountry();

function CheckoutPageInner() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') ?? undefined;
  const [step, setStep] = useState(1);
  // Guided sub-steps within step 1: 1 = experience, 2 = package + price, 3 = details
  const [formStep, setFormStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageSlug>('CAREER_BOOSTER');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(INITIAL_COUNTRY.code);
  const [countryName, setCountryName] = useState(INITIAL_COUNTRY.name);
  const [preferredGateway, setPreferredGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  const [experienceLevel, setExperienceLevel] = useState<'FRESHER' | 'MID_CAREER' | 'EXECUTIVE' | 'EXECUTIVE_PLUS'>('MID_CAREER');
  const [pricingPreview, setPricingPreview] = useState<{
    currency: string; currencySymbol: string;
    services: { slug: string; price: number; complimentary?: boolean }[];
    complementaryServices: string[];
    subtotal: number; discountRate: number; discountAmount: number;
    subtotalAfterDiscount: number; taxRate: number; taxAmount: number;
    finalPayable: number; isIndia: boolean; gateway: string;
  } | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [website] = useState('');
  const [startedAt] = useState(() => Date.now());
  const submitting = useRef(false);

  // Email OTP state
  const [otpStep,      setOtpStep]      = useState(false);
  const [otpToken,     setOtpToken]     = useState('');
  const [otpCode,      setOtpCode]      = useState('');
  const [otpError,     setOtpError]     = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [showTierConfirm, setShowTierConfirm] = useState(false);
  const [gatewaySwitching, setGatewaySwitching] = useState(false);
  const [localRate, setLocalRate] = useState<{ rate: number; code: string; symbol: string } | null>(null);

  useEffect(() => {
    if (countryCode === 'IN') { setLocalRate(null); return; }
    let cancelled = false;
    fetch(`/api/public/exchange-rate?country=${encodeURIComponent(countryName)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.rate && d.code !== 'USD') setLocalRate(d); else if (!cancelled) setLocalRate(null); })
      .catch(() => { if (!cancelled) setLocalRate(null); });
    return () => { cancelled = true; };
  }, [countryCode, countryName]);

  const resolveServices = (): string[] => {
    if (selectedPackage === 'PREMIUM_PLUS') {
      return SELF_SERVICE_PACKAGES.PREMIUM_PLUS.services;
    }
    if (selectedPackage === 'CAREER_BOOSTER') {
      return SELF_SERVICE_PACKAGES.CAREER_BOOSTER.services;
    }
    return customServices;
  };

  const dispatchOtp = async () => {
    submitting.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/public/checkout/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not send verification code. Please try again.');
      }
      const { token } = await res.json();
      setOtpToken(token);
      setOtpCode('');
      setOtpError('');
      setOtpStep(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send verification code');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const scrollTop = () => { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const goToFormStep = (n: number) => { setFormStep(n); scrollTop(); };

  const handleFormNext = () => {
    // Leaving the package step requires at least one service selected
    if (formStep === 1 && resolveServices().length === 0) {
      return alert('Please choose a package or at least one service.');
    }
    goToFormStep(Math.min(3, formStep + 1));
  };

  const handleReviewOrder = () => {
    if (submitting.current) return;
    if (!name.trim()) return alert('Please enter your full name.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return alert('Please enter a valid email address.');
    if (!phone || phone.replace(/\D/g, '').length < 7) return alert('Please enter a valid phone number including country code.');
    const services = resolveServices();
    if (services.length === 0) return alert('Select at least one service.');
    setShowTierConfirm(true);
  };

  const handleResendOtp = async () => {
    setOtpResending(true);
    try {
      const res = await fetch('/api/public/checkout/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });
      if (res.ok) {
        const { token } = await res.json();
        setOtpToken(token);
        setOtpCode('');
        setOtpError('');
      }
    } finally {
      setOtpResending(false);
    }
  };

  const fetchPreview = async (gateway: 'RAZORPAY' | 'PAYPAL') => {
    const previewRes = await fetch('/api/public/checkout/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageSlug: selectedPackage,
        services: resolveServices(),
        countryCode,
        countryName,
        tierHint: experienceLevel,
        preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : gateway,
      }),
    });
    if (!previewRes.ok) {
      const d = await previewRes.json().catch(() => ({}));
      throw new Error(d.error || 'Could not load pricing. Please try again.');
    }
    return previewRes.json();
  };

  // Switching payment method on the review step re-prices the order
  // (gateway fees differ), so totals always match what will be charged.
  const handleGatewayChange = async (gateway: 'RAZORPAY' | 'PAYPAL') => {
    if (gateway === preferredGateway || gatewaySwitching) return;
    const previous = preferredGateway;
    setPreferredGateway(gateway);
    setGatewaySwitching(true);
    try {
      setPricingPreview(await fetchPreview(gateway));
    } catch {
      setPreferredGateway(previous);
      alert('Could not update pricing for that payment method. Please try again.');
    } finally {
      setGatewaySwitching(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    setOtpError('');
    try {
      const verifyRes = await fetch('/api/public/checkout/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:       email.trim().toLowerCase(),
          code:        otpCode,
          token:       otpToken,
          name:        name.trim(),
          phone:       phone.trim(),
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          tier:        experienceLevel,
          countryCode,
          countryName,
        }),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        setOtpError(d.error ?? 'Incorrect code. Please try again.');
        return;
      }
      setPricingPreview(await fetchPreview(preferredGateway));
      setOtpStep(false);
      setStep(2);
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/public/checkout/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: `+${phone}`,
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          countryCode,
          countryName,
          experienceLevel,
          packageSlug: selectedPackage,
          services: resolveServices(),
          preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : preferredGateway,
          website,
          startedAt,
          ...(referralCode ? { ref: referralCode } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Checkout failed');
      }
      const data = await res.json();
      if (data.checkoutSessionId) {
        window.location.href = `/checkout/session/${data.checkoutSessionId}`;
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      throw new Error('Payment link unavailable. Please try again.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bone text-brand-obsidian">
      <div className="fixed top-0 left-0 h-[2px] bg-brand-parchment w-full z-50">
        <div
          className="h-full bg-brand-gold transition-all duration-500"
          style={{ width: step === 2 ? '100%' : otpStep ? '67%' : '33%' }}
        />
      </div>

      <header className="px-8 md:px-16 lg:px-24 py-8 flex items-center justify-between">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
        <Link
          href="/inquire"
          className="text-status uppercase tracking-widest text-brand-obsidian/40 hover:text-brand-gold"
        >
          Need a consultation? →
        </Link>
      </header>

      {step === 1 && otpStep && (
        <main className="px-8 md:px-16 lg:px-24 pb-24 pt-12 max-w-md mx-auto">
          <button
            onClick={() => { setOtpStep(false); setOtpCode(''); setOtpError(''); }}
            className="flex items-center gap-2 text-brand-obsidian/40 hover:text-brand-obsidian text-sm uppercase tracking-widest mb-12 transition-colors"
          >
            ← Back
          </button>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-[#F0EAE0] rounded-full flex items-center justify-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                <path stroke="#B8935B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-3">Verify Email</p>
            <h2 className="font-serif text-[clamp(1.6rem,4vw,2.2rem)] leading-tight mb-3">Check your inbox</h2>
            <p className="text-sm text-brand-obsidian/50 mb-8">
              We sent a 6-digit code to{' '}
              <strong className="text-brand-obsidian">{email}</strong>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
              placeholder="000000"
              className="w-full text-center text-3xl font-bold tracking-[0.5em] border-b-2 border-brand-parchment py-4 bg-transparent outline-none focus:border-brand-gold mb-2 transition-colors"
            />
            {otpError
              ? <p className="text-sm text-red-600 mb-6 mt-1">{otpError}</p>
              : <p className="text-xs text-brand-obsidian/35 mb-6 mt-1">Expires in 10 minutes · Check spam if not received</p>
            }
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50 transition-colors mb-5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={otpResending}
              className="text-sm text-brand-obsidian/40 hover:text-brand-gold transition-colors"
            >
              {otpResending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        </main>
      )}

      {step === 1 && !otpStep && (
        <main className="px-6 sm:px-10 lg:px-16 pb-24 pt-8 max-w-2xl mx-auto">
          {/* Wizard progress header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex-1 h-1 rounded-full transition-colors" style={{ background: n <= formStep ? '#B8935B' : '#E8E4DC' }} />
              ))}
            </div>
            <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-2">
              Step {formStep} of 3
            </p>
            <h1 className="font-serif text-[clamp(1.7rem,4vw,2.4rem)] leading-tight">
              {formStep === 1 ? 'Choose your package' : formStep === 2 ? 'Your experience level' : 'Your details'}
            </h1>
            <p className="text-sm text-brand-obsidian/50 mt-2">
              {formStep === 1
                ? 'Pick what fits your goals — pricing is tailored to your experience in the next step.'
                : formStep === 2
                ? 'Pricing reflects the depth of work your career stage needs.'
                : 'Enter your details, then review the full price before paying.'}
            </p>
          </div>

          {/* ── Step 1: Package ── */}
          {formStep === 1 && (
            <div className="space-y-5">
              {(['PREMIUM_PLUS', 'CAREER_BOOSTER', 'CUSTOM'] as PackageSlug[]).map((pkg) => {
                return (
                  <button
                    key={pkg}
                    type="button"
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full text-left p-6 border transition-all ${
                      selectedPackage === pkg
                        ? 'border-brand-gold bg-brand-gold/5'
                        : 'border-brand-parchment hover:border-brand-obsidian/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-subheading">
                          {SELF_SERVICE_PACKAGES[pkg].label}
                        </h3>
                        {pkg === 'PREMIUM_PLUS' && (
                          <Star className="w-4 h-4 text-brand-gold fill-brand-gold flex-shrink-0" />
                        )}
                      </div>
                      {/* Price is revealed in the next step, after experience is chosen */}
                      {pkg === 'CUSTOM' ? (
                        <p className="text-xs text-brand-obsidian/40 flex-shrink-0">Select services →</p>
                      ) : selectedPackage === pkg ? (
                        <span className="text-xs font-bold text-brand-gold flex-shrink-0">Selected ✓</span>
                      ) : null}
                    </div>
                    <p className="text-body text-brand-obsidian/60 mb-3 font-medium">
                      {SELF_SERVICE_PACKAGES[pkg].description}
                    </p>
                    <ul className="text-sm text-brand-obsidian/50 space-y-1 list-disc list-inside">
                      {SELF_SERVICE_PACKAGES[pkg].features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}

              {selectedPackage === 'CUSTOM' && (
                <div className="pt-2 space-y-2">
                  {([
                    { value: 'RESUME',       label: 'Resume Writing',    sub: 'ATS-optimised, keyword-rich, tailored to your role & industry' },
                    { value: 'LINKEDIN',     label: 'LinkedIn Profile',  sub: 'Full optimisation · custom Banner · Profile Picture' },
                    { value: 'COVER_LETTER', label: 'Cover Letter',      sub: 'Compelling narrative, targeted to each application' },
                    { value: 'PORTFOLIO',    label: 'Portfolio Website', sub: 'Custom personal site to showcase your work online' },
                  ] as const).map(({ value, label, sub }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setCustomServices((prev) =>
                          prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
                        )
                      }
                      className={`w-full text-left px-4 py-3 border transition-all flex items-center gap-3 ${
                        customServices.includes(value)
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-parchment hover:border-brand-obsidian/20'
                      }`}
                    >
                      <div className={`w-4 h-4 flex-shrink-0 border-2 transition-colors flex items-center justify-center ${
                        customServices.includes(value) ? 'border-brand-gold bg-brand-gold' : 'border-brand-parchment'
                      }`}>
                        {customServices.includes(value) && (
                          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                            <path stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-5"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-brand-obsidian">{label}</div>
                        <div className="text-xs text-brand-obsidian/45 mt-0.5">{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Continue to experience */}
              <button
                onClick={handleFormNext}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite transition-colors mt-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Experience + price ── */}
          {formStep === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-brand-obsidian/45 mb-4">How many years have you been working professionally?</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([
                    { value: 'FRESHER',        label: '0–2 years',  sub: 'Graduate or early career' },
                    { value: 'MID_CAREER',     label: '3–8 years',  sub: 'Established professional' },
                    { value: 'EXECUTIVE',      label: '9–15 years', sub: 'Senior, manager or specialist' },
                    { value: 'EXECUTIVE_PLUS', label: '15+ years',  sub: 'Director, VP or C-level' },
                  ] as const).map(({ value, label, sub }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setExperienceLevel(value)}
                      className={`text-left p-3 border transition-all ${
                        experienceLevel === value
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-parchment hover:border-brand-obsidian/20'
                      }`}
                    >
                      <div className="text-sm font-semibold text-brand-obsidian">{label}</div>
                      <div className="text-xs text-brand-obsidian/45 mt-0.5">{sub}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-brand-obsidian/40 leading-relaxed mt-3">
                  Pricing reflects the complexity of your career journey — senior and executive profiles involve deeper research, more nuanced positioning, and significantly more iterative work than early-career documents.
                </p>
              </div>

              {/* ── Live price estimate ─────────────────────────────── */}
              {(() => {
                const cur  = countryCode === 'IN' ? 'INR' : 'USD';
                const live = computePrice(selectedPackage, experienceLevel, cur, customServices);
                if (live.services.length === 0) return null;
                return (
                  <div className="border border-brand-parchment p-5 bg-white/60">
                    <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-4 text-[10px]">
                      Estimated Price · {experienceLevel === 'FRESHER' ? '0–2 yrs' : experienceLevel === 'MID_CAREER' ? '3–8 yrs' : experienceLevel === 'EXECUTIVE' ? '9–15 yrs' : '15+ yrs'}
                    </p>
                    <div className="space-y-2.5 mb-4">
                      {live.services.map(s => (
                        <div key={s.slug} className="flex items-center justify-between text-sm">
                          <span className="text-brand-obsidian/70">{s.label}</span>
                          {s.complimentary ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full leading-none">FREE</span>
                              <span className="font-medium text-emerald-700 tabular-nums line-through text-xs text-brand-obsidian/35">{live.sym}{(PRICING.basePrices[countryCode === 'IN' ? 'INR' : 'USD'][s.slug as ServiceSlug]?.[experienceLevel] ?? 0).toLocaleString()}</span>
                            </span>
                          ) : (
                            <span className="text-right">
                              <span className="font-medium text-brand-obsidian tabular-nums">{live.sym}{s.price.toLocaleString()}</span>
                              {localRate && s.price > 0 && (
                                <span className="block text-[10px] text-brand-obsidian/35 tabular-nums">≈ {localRate.symbol}{Math.round(s.price * localRate.rate).toLocaleString()}</span>
                              )}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {live.discount > 0 && (
                      <div className="flex items-center justify-between text-sm border-t border-brand-parchment pt-3 mb-2">
                        <span className="text-brand-obsidian/50">Subtotal</span>
                        <span className="text-brand-obsidian/50 tabular-nums">{live.sym}{live.subtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {live.discount > 0 && (
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="text-emerald-700 font-semibold">Package discount ({Math.round(live.rate * 100)}%)</span>
                        <span className="text-emerald-700 font-semibold tabular-nums">−{live.sym}{live.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-brand-parchment pt-3">
                      <span className="font-serif text-subheading">
                        {live.discount > 0 ? 'Total' : 'Subtotal'}
                      </span>
                      <span className="text-right">
                        <span className="font-bold text-xl text-brand-gold tabular-nums">{live.sym}{live.total.toLocaleString()}</span>
                        {localRate && live.total > 0 && (
                          <span className="block text-xs text-brand-obsidian/40 tabular-nums">≈ {localRate.symbol}{Math.round(live.total * localRate.rate).toLocaleString()} {localRate.code}</span>
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-brand-obsidian/30 mt-2">
                      + gateway fee &amp; applicable taxes shown at checkout · no card details needed here
                    </p>
                  </div>
                );
              })()}

              {/* ── Full pricing table ──────────────────────────────── */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-brand-obsidian/40 hover:text-brand-gold uppercase tracking-widest font-semibold list-none flex items-center gap-2 select-none">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  View full pricing table (all services &amp; experience levels)
                  <span className="ml-auto text-[10px] font-bold text-brand-gold/70 normal-case tracking-normal">
                    {countryCode === 'IN' ? '₹ INR' : '$ USD'}
                  </span>
                </summary>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-brand-parchment">
                        <th className="text-left py-2 pr-3 font-semibold text-brand-obsidian/50 uppercase tracking-wide">Service</th>
                        {(['FRESHER','MID_CAREER','EXECUTIVE','EXECUTIVE_PLUS'] as ExperienceKey[]).map(t => (
                          <th key={t} className={`text-right py-2 px-2 font-semibold uppercase tracking-wide whitespace-nowrap ${experienceLevel === t ? 'text-brand-gold' : 'text-brand-obsidian/40'}`}>
                            {t === 'FRESHER' ? '0–2 yrs' : t === 'MID_CAREER' ? '3–8 yrs' : t === 'EXECUTIVE' ? '9–15 yrs' : '15+ yrs'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['RESUME','LINKEDIN','COVER_LETTER','PORTFOLIO'] as ServiceSlug[]).map(slug => {
                        const cur = countryCode === 'IN' ? 'INR' : 'USD';
                        const sym = cur === 'INR' ? '₹' : '$';
                        return (
                          <tr key={slug} className="border-b border-brand-parchment/60">
                            <td className="py-2.5 pr-3 text-brand-obsidian/70 font-medium">{SERVICE_LABELS[slug]}</td>
                            {(['FRESHER','MID_CAREER','EXECUTIVE','EXECUTIVE_PLUS'] as ExperienceKey[]).map(t => (
                              <td key={t} className={`text-right py-2.5 px-2 tabular-nums font-medium ${experienceLevel === t ? 'text-brand-obsidian font-bold' : 'text-brand-obsidian/40'}`}>
                                {sym}{PRICING.basePrices[cur][slug][t].toLocaleString()}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="pt-3 text-brand-obsidian/30 text-[10px]">
                          Career Booster (Resume + LinkedIn + Cover Letter) = 15% off · Premium Plus (all 4) = 20% off · Custom = no discount
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>

              {/* Nav */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => goToFormStep(1)}
                  className="px-6 py-4 border border-brand-parchment text-brand-obsidian/60 font-semibold uppercase tracking-widest text-sm hover:border-brand-obsidian/30 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleFormNext}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite transition-colors"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {formStep === 3 && (
            <div className="space-y-5">
              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-b border-brand-parchment py-3 bg-transparent outline-none focus:border-brand-gold"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-b border-brand-parchment py-3 bg-transparent outline-none focus:border-brand-gold"
              />
              <div className="w-full relative react-phone-container">
                <PhoneInput
                  country={INITIAL_COUNTRY.phone}
                  value={phone}
                  onChange={(value, country, e, formattedValue) => {
                    setPhone(value);
                    setCountryCode((country as any).countryCode?.toUpperCase() || 'IN');
                    setCountryName((country as any).name || 'India');
                  }}
                  inputClass="!w-full !border-0 !border-b !border-brand-parchment !py-3 !bg-transparent !outline-none focus:!border-brand-gold !text-base !font-sans !rounded-none !pl-[50px]"
                  buttonClass="!border-0 !border-b !border-brand-parchment !bg-transparent !rounded-none"
                  containerClass="!w-full"
                  placeholder="Mobile Number"
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="WhatsApp number (optional, if different from above)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full border-b border-brand-parchment py-3 bg-transparent outline-none focus:border-brand-gold text-sm"
                />
                <p className="text-xs text-brand-obsidian/30 mt-1">Include country code · e.g. +91 98765 43210</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => goToFormStep(2)}
                  className="px-6 py-4 border border-brand-parchment text-brand-obsidian/60 font-semibold uppercase tracking-widest text-sm hover:border-brand-obsidian/30 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleReviewOrder}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Review Order & Price
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              <p className="text-metadata text-brand-obsidian/35 text-center">
                See full price breakdown before paying · No card details needed here
              </p>
            </div>
          )}
        </main>
      )}

      {step === 2 && pricingPreview && (
        <main className="px-8 md:px-16 lg:px-24 pb-24 pt-12 max-w-xl mx-auto">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-brand-obsidian/40 hover:text-brand-obsidian text-sm uppercase tracking-widest mb-10 transition-colors"
          >
            ← Back
          </button>

          <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-3">Order Summary</p>
          <h1 className="font-serif text-[clamp(1.6rem,4vw,2.4rem)] leading-tight mb-4">
            Review before you pay
          </h1>
          <p className="text-sm text-brand-obsidian/50 mb-8">
            Your experience: <span className="font-semibold text-brand-obsidian">
              {experienceLevel === 'FRESHER' ? '0–2 years'
               : experienceLevel === 'MID_CAREER' ? '3–8 years'
               : experienceLevel === 'EXECUTIVE' ? '9–15 years'
               : '15+ years'}
            </span>
          </p>

          {/* Services */}
          <div className={`border-t border-brand-parchment transition-opacity ${gatewaySwitching ? 'opacity-40' : ''}`}>
            {pricingPreview.services.map((s) => (
              <div key={s.slug} className="flex items-center justify-between py-4 border-b border-brand-parchment">
                <span className="text-body text-brand-obsidian/80">
                  {s.slug === 'RESUME' ? 'Professional Resume Writing'
                   : s.slug === 'LINKEDIN' ? 'LinkedIn Profile Optimisation'
                   : s.slug === 'COVER_LETTER' ? 'Cover Letter Writing'
                   : 'Portfolio Website Development'}
                </span>
                {s.complimentary ? (
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full leading-none">FREE</span>
                    <span className="font-semibold text-emerald-700">Complimentary</span>
                  </span>
                ) : (
                  <span className="font-semibold text-brand-obsidian">
                    {pricingPreview.currencySymbol}{s.price.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Payment method — international clients choose here, next to the totals it affects */}
          {countryCode !== 'IN' && (
            <div className="pt-6 pb-2">
              <p className="text-status uppercase tracking-widest text-brand-obsidian/40 mb-3">
                Payment Method
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  {
                    value: 'PAYPAL' as const,
                    label: 'PayPal',
                    sub: 'Charged in USD ($) · card or PayPal balance · PayPal converts to your currency',
                  },
                  {
                    value: 'RAZORPAY' as const,
                    label: 'Card (Local Currency)',
                    sub: 'Charged directly in your local currency — no conversion on your end',
                  },
                ]).map(({ value, label, sub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void handleGatewayChange(value)}
                    disabled={gatewaySwitching}
                    aria-pressed={preferredGateway === value}
                    className={`text-left p-4 border transition-all disabled:opacity-60 ${
                      preferredGateway === value
                        ? 'border-brand-gold bg-brand-gold/5'
                        : 'border-brand-parchment hover:border-brand-obsidian/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        preferredGateway === value ? 'border-brand-gold' : 'border-brand-parchment'
                      }`}>
                        {preferredGateway === value && <div className="w-1.5 h-1.5 rounded-full bg-brand-gold" />}
                      </div>
                      <span className="text-sm font-semibold text-brand-obsidian">{label}</span>
                    </div>
                    <p className="text-xs text-brand-obsidian/50 leading-relaxed pl-[22px]">{sub}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-brand-obsidian/40 mt-3">
                {preferredGateway === 'PAYPAL'
                  ? 'PayPal converts USD to your local currency at the rate your bank or PayPal applies.'
                  : 'The exact local amount below is calculated at the prevailing exchange rate — what you see is what you pay.'}
                {' '}Questions?{' '}
                <a href="mailto:catalyst@theripplenexus.com" className="text-brand-gold hover:underline">catalyst@theripplenexus.com</a>
              </p>
            </div>
          )}

          {/* Breakdown */}
          <div className={`pt-4 space-y-3 transition-opacity ${gatewaySwitching ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex justify-between text-sm text-brand-obsidian/60">
              <span>Subtotal</span>
              <span>{pricingPreview.currencySymbol}{pricingPreview.subtotal.toLocaleString()}</span>
            </div>
            {pricingPreview.discountRate > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Package discount ({Math.round(pricingPreview.discountRate * 100)}% off)</span>
                <span>−{pricingPreview.currencySymbol}{pricingPreview.discountAmount.toLocaleString()}</span>
              </div>
            )}
            {pricingPreview.taxRate > 0 && (
              <div className="flex justify-between text-sm text-brand-obsidian/60">
                <span>GST ({Math.round(pricingPreview.taxRate * 100)}%)</span>
                <span>+{pricingPreview.currencySymbol}{pricingPreview.taxAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-brand-parchment pt-4 flex justify-between items-baseline">
              <span className="font-serif text-subheading">Total Payable</span>
              <span className="font-serif text-display text-brand-gold">
                {pricingPreview.currencySymbol}{pricingPreview.finalPayable.toLocaleString()}
              </span>
            </div>
            <p className="text-metadata text-brand-obsidian/35">
              {pricingPreview.gateway === 'RAZORPAY'
                ? 'All-inclusive · payment processing covered · no hidden charges'
                : 'All-inclusive · PayPal fees covered · no hidden charges'}
            </p>
          </div>

          {/* Referral notice */}
          {referralCode && (
            <div className="mt-6 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700">Referral code <strong>{referralCode}</strong> applied</p>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirmPayment}
            disabled={loading || gatewaySwitching}
            className="w-full mt-8 inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50 transition-colors"
          >
            {loading || gatewaySwitching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Confirm & Pay {pricingPreview.currencySymbol}{pricingPreview.finalPayable.toLocaleString()}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-metadata text-brand-obsidian/35 text-center mt-3">
            Secure payment via {pricingPreview.gateway === 'RAZORPAY' ? 'Razorpay' : 'PayPal'} · Portal access granted immediately after payment
          </p>
        </main>
      )}
      {/* ── Experience level confirmation modal ─────────────────── */}
      {showTierConfirm && (() => {
        const TIER_INFO: Record<ExperienceKey, { label: string; years: string; note: string }> = {
          FRESHER:        { label: 'Early Career',        years: '0–2 years',  note: 'This tier is designed for graduates, interns, and professionals just entering the workforce.' },
          MID_CAREER:     { label: 'Mid Career',          years: '3–8 years',  note: 'This tier is designed for professionals with a solid track record in their field.' },
          EXECUTIVE:      { label: 'Senior / Manager',    years: '9–15 years', note: 'This tier is designed for senior specialists, managers, and team leads with deep domain expertise.' },
          EXECUTIVE_PLUS: { label: 'Director / Executive', years: '15+ years', note: 'This tier is designed for directors, VPs, and C-suite leaders operating at the highest career level.' },
        };
        const info = TIER_INFO[experienceLevel];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-obsidian/60 backdrop-blur-sm px-6">
            <div className="bg-white w-full max-w-md p-8 shadow-2xl">
              <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-1 text-[10px]">Confirm Experience Level</p>
              <h2 className="font-serif text-[1.4rem] leading-tight mb-1">{info.label}</h2>
              <p className="text-sm text-brand-obsidian/40 font-medium mb-5">{info.years}</p>
              <div className="bg-[#FDFAF6] border border-brand-parchment p-4 mb-6">
                <p className="text-sm text-brand-obsidian/70 leading-relaxed">{info.note}</p>
                <p className="text-sm text-brand-obsidian/70 leading-relaxed mt-3">
                  Our team calibrates the depth, research, and positioning of your documents to this career stage. Selecting a lower level than your actual experience will result in materials that underrepresent your profile.
                </p>
              </div>
              <p className="text-xs text-brand-obsidian/40 mb-6">
                If this doesn&apos;t match your career stage, please change it before continuing. You won&apos;t be able to switch after payment.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTierConfirm(false); void dispatchOtp(); }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite transition-colors"
                >
                  Yes, {info.years} is correct — Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowTierConfirm(false)}
                  className="w-full py-3 text-sm text-brand-obsidian/50 hover:text-brand-obsidian uppercase tracking-widest transition-colors border border-brand-parchment"
                >
                  Change Experience Level
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx global>{`
        .react-phone-container .flag-dropdown {
          background: transparent !important;
          border: none !important;
          border-bottom: 1px solid #e8e4dc !important;
          border-radius: 0 !important;
        }
        .react-phone-container .form-control {
          background: transparent !important;
          border: none !important;
          border-bottom: 1px solid #e8e4dc !important;
          border-radius: 0 !important;
          padding-left: 50px !important;
          width: 100% !important;
        }
        .react-phone-container .form-control:focus {
          border-color: #b8935b !important;
          box-shadow: none !important;
        }
        .react-phone-container .selected-flag {
          padding: 0 0 0 8px !important;
          background: transparent !important;
        }
        .react-phone-container .selected-flag:hover, 
        .react-phone-container .selected-flag:focus {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
