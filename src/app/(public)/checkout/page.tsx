'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, Loader2, Lock, Star } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SELF_SERVICE_PACKAGES } from '@/lib/catalog/self-service';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

type PackageSlug = 'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM';

export default function CatalystCheckoutPage() {
  return (
    <Suspense>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') ?? undefined;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageSlug>('CAREER_BOOSTER');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [countryName, setCountryName] = useState('India');
  const [preferredGateway, setPreferredGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  const [experienceLevel, setExperienceLevel] = useState<'FRESHER' | 'MID_CAREER' | 'EXECUTIVE' | 'EXECUTIVE_PLUS'>('MID_CAREER');
  const [pricingPreview, setPricingPreview] = useState<{
    currency: string; currencySymbol: string;
    services: { slug: string; price: number }[];
    subtotal: number; discountRate: number; discountAmount: number;
    subtotalAfterDiscount: number; taxRate: number; taxAmount: number;
    finalPayable: number; isIndia: boolean; gateway: string;
  } | null>(null);
  const [website] = useState('');
  const [startedAt] = useState(() => Date.now());
  const submitting = useRef(false);

  const resolveServices = (): string[] => {
    if (selectedPackage === 'PREMIUM_PLUS') {
      return SELF_SERVICE_PACKAGES.PREMIUM_PLUS.services;
    }
    if (selectedPackage === 'CAREER_BOOSTER') {
      return SELF_SERVICE_PACKAGES.CAREER_BOOSTER.services;
    }
    return customServices;
  };

  const handleReviewOrder = async () => {
    if (submitting.current) return;
    if (!name.trim()) return alert('Please enter your full name.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return alert('Please enter a valid email address.');
    if (!phone || phone.replace(/\D/g, '').length < 7) return alert('Please enter a valid phone number including country code.');
    const services = resolveServices();
    if (services.length === 0) return alert('Select at least one service.');

    submitting.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/public/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageSlug: selectedPackage,
          services,
          countryCode,
          countryName,
          tierHint: experienceLevel,
          preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : preferredGateway,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not load pricing. Please try again.');
      }
      setPricingPreview(await res.json());
      setStep(2);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
      submitting.current = false;
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
          style={{ width: step === 1 ? '50%' : '100%' }}
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

      {step === 1 && (
        <main className="px-8 md:px-16 lg:px-24 pb-24">
          <section className="mb-16 max-w-3xl">
            <p className="text-status text-brand-gold uppercase tracking-widest font-bold mb-4">
              Self-Service
            </p>
            <h1 className="font-serif text-[clamp(2rem,5vw,3rem)] leading-tight mb-6">
              Get Started Today
            </h1>
            <p className="text-subheading text-brand-obsidian/55">
              Choose your package, pay securely, and access your portal immediately. No approval
              wait. Intake forms happen after payment.
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-6 space-y-6">
              <h2 className="font-serif text-heading mb-2">Choose Package</h2>
              {(['PREMIUM_PLUS', 'CAREER_BOOSTER', 'CUSTOM'] as PackageSlug[]).map((pkg) => (
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
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif text-subheading">
                      {SELF_SERVICE_PACKAGES[pkg].label}
                    </h3>
                    {pkg === 'PREMIUM_PLUS' && (
                      <Star className="w-4 h-4 text-brand-gold fill-brand-gold" />
                    )}
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
              ))}

              {selectedPackage === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'].map((svc) => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() =>
                        setCustomServices((prev) =>
                          prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
                        )
                      }
                      className={`py-2 px-3 border text-metadata uppercase tracking-widest ${
                        customServices.includes(svc)
                          ? 'bg-brand-obsidian text-brand-bone border-brand-obsidian'
                          : 'border-brand-parchment'
                      }`}
                    >
                      {svc.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}

              {countryCode !== 'IN' && (
                <div className="pt-4">
                  <p className="text-status uppercase tracking-widest text-brand-obsidian/40 mb-3">
                    Payment Method
                  </p>
                  <div className="flex gap-3">
                    {(['PAYPAL', 'RAZORPAY'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPreferredGateway(g)}
                        className={`px-4 py-2 border text-metadata uppercase ${
                          preferredGateway === g
                            ? 'border-brand-obsidian bg-brand-obsidian text-brand-bone'
                            : 'border-brand-parchment'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 lg:col-start-8 space-y-6">
              <div>
                <h2 className="font-serif text-heading mb-1.5">Years of Experience</h2>
                <p className="text-sm text-brand-obsidian/45 mb-4">How many years have you been working professionally?</p>
                <div className="grid grid-cols-2 gap-2">
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
              </div>

              <h2 className="font-serif text-heading">Your Details</h2>
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
                  country={'in'}
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

              <button
                onClick={handleReviewOrder}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50 mt-4"
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
              <p className="text-metadata text-brand-obsidian/35 text-center">
                See full price breakdown before paying · No card details needed here
              </p>
            </div>
          </div>
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
          <div className="border-t border-brand-parchment">
            {pricingPreview.services.map((s) => (
              <div key={s.slug} className="flex items-center justify-between py-4 border-b border-brand-parchment">
                <span className="text-body text-brand-obsidian/80">
                  {s.slug === 'RESUME' ? 'Professional Resume Writing'
                   : s.slug === 'LINKEDIN' ? 'LinkedIn Profile Optimisation'
                   : s.slug === 'COVER_LETTER' ? 'Cover Letter Writing'
                   : 'Portfolio Website Development'}
                </span>
                <span className="font-semibold text-brand-obsidian">
                  {pricingPreview.currencySymbol}{s.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="pt-4 space-y-3">
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
            disabled={loading}
            className="w-full mt-8 inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50 transition-colors"
          >
            {loading ? (
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
