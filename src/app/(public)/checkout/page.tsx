'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Loader2, Lock, Star } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SELF_SERVICE_PACKAGES } from '@/lib/catalog/self-service';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+65', country: 'SG', name: 'Singapore', flag: '🇸🇬' },
] as const;

type PackageSlug = 'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM';

export default function CatalystCheckoutPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageSlug>('CAREER_BOOSTER');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [preferredGateway, setPreferredGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  const [pricingDraft, setPricingDraft] = useState<Record<string, unknown> | null>(null);
  const [website] = useState('');
  const [startedAt] = useState(() => Date.now());

  const selectedCountry = COUNTRY_CODES.find((c) => c.country === countryCode);

  const resolveServices = (): string[] => {
    if (selectedPackage === 'PREMIUM_PLUS') {
      return SELF_SERVICE_PACKAGES.PREMIUM_PLUS.services;
    }
    if (selectedPackage === 'CAREER_BOOSTER') {
      return SELF_SERVICE_PACKAGES.CAREER_BOOSTER.services;
    }
    return customServices;
  };

  const handleCheckout = async () => {
    if (!name || !email || !phone) return alert('Please fill in all contact details.');
    const services = resolveServices();
    if (services.length === 0) return alert('Select at least one service.');

    setLoading(true);
    try {
      const endpoint = '/api/public/checkout/draft';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: `${phoneCode} ${phone}`,
          countryCode,
          countryName: selectedCountry?.name || 'India',
          experienceLevel: 'MID_CAREER',
          packageSlug: selectedPackage,
          services,
          preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : preferredGateway,
          website,
          startedAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Checkout failed');
      }

      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl as string;
        return;
      }
      setPricingDraft(data);
      setStep(2);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const payNow = () => {
    const url = pricingDraft?.paymentUrl as string | undefined;
    if (url) window.location.href = url;
    else alert('Payment link unavailable. Check your email or contact support.');
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
              <div className="flex gap-3">
                <select
                  value={phoneCode}
                  onChange={(e) => {
                    setPhoneCode(e.target.value);
                    const m = COUNTRY_CODES.find((c) => c.code === e.target.value);
                    if (m) setCountryCode(m.country);
                  }}
                  className="border-b border-brand-parchment py-3 bg-transparent outline-none"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={`${c.code}-${c.country}`} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 border-b border-brand-parchment py-3 bg-transparent outline-none focus:border-brand-gold"
                />
              </div>
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  const m = COUNTRY_CODES.find((c) => c.country === e.target.value);
                  if (m) setPhoneCode(m.code);
                }}
                className="w-full border-b border-brand-parchment py-3 bg-transparent outline-none"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.country} value={c.country}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Continue to Payment
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-metadata text-brand-obsidian/35 text-center">
                Secure payment · Portal access after checkout · No forms before payment
              </p>
            </div>
          </div>
        </main>
      )}

      {step === 2 && pricingDraft && (
        <main className="px-8 md:px-16 lg:px-24 py-24 max-w-lg mx-auto text-center">
          <Check className="w-10 h-10 text-brand-gold mx-auto mb-6" />
          <h1 className="font-serif text-heading mb-4">Ready to Pay</h1>
          <p className="text-body text-brand-obsidian/50 mb-8">
            Total: {String(pricingDraft.currencySymbol)}
            {Number(pricingDraft.finalPayable).toLocaleString()}
          </p>
          <button
            onClick={payNow}
            className="w-full bg-brand-obsidian text-brand-bone py-4 font-semibold uppercase tracking-widest"
          >
            Pay Now
          </button>
        </main>
      )}
    </div>
  );
}
