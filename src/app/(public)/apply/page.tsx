'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Star, ArrowRight, Loader2, Lock, ArrowUpRight } from 'lucide-react';
import { ClientType } from '@prisma/client';
import { Logo } from '@/components/Logo';

/**
 * /apply — The "Direct Checkout" Flow
 * 
 * Same Catalyst Brand System aesthetic as /inquire:
 *  - Bone (#F4F1EB) ground, Obsidian (#0A0B0D) text, Signal Gold (#B8935B) accent
 *  - Asymmetric, left-weighted layout
 *  - Serif headlines, grotesque body
 *  - No SaaS boxes. Underline inputs. Editorial structure.
 * 
 * 3-step wizard: Details → Services → Checkout
 * All business logic preserved exactly.
 */

const COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+1', country: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', country: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+65', country: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+49', country: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'FR', name: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: '+971', country: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', country: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+31', country: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', country: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: '+41', country: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+353', country: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: '+45', country: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: '+358', country: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: '+47', country: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: '+64', country: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+34', country: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: '+351', country: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: '+48', country: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: '+420', country: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+32', country: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: '+43', country: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: '+972', country: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: '+886', country: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: '+852', country: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: '+60', country: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', country: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+66', country: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', country: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', country: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: '+27', country: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', country: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: '+20', country: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: '+55', country: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: '+90', country: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: '+30', country: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: '+40', country: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: '+36', country: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: '+359', country: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
] as const;

export default function CatalystApplyPage() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1 State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [experienceLevel, setExperienceLevel] = useState<ClientType>('MID_CAREER');
  
  // Step 2 State
  const [selectedPackage, setSelectedPackage] = useState<'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM'>('CAREER_BOOSTER');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [preferredGateway, setPreferredGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  
  // Pricing Result State
  const [pricingDraft, setPricingDraft] = useState<any>(null);
  
  const handleNextStep1 = () => {
    if (!name || !email || !phone) return alert('Please fill in all details.');
    setStep(2);
  };
  
  const handleNextStep2 = async () => {
    setLoading(true);
    try {
      let servicesToPass: string[] = [];
      if (selectedPackage === 'PREMIUM_PLUS') {
        servicesToPass = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'];
      } else if (selectedPackage === 'CAREER_BOOSTER') {
        servicesToPass = ['RESUME', 'LINKEDIN', 'COVER_LETTER'];
      } else {
        if (customServices.length === 0) {
          setLoading(false);
          return alert('Please select at least one service.');
        }
        servicesToPass = customServices;
      }
      
      const selectedCountry = COUNTRY_CODES.find(c => c.country === countryCode);

      const payload = {
        name,
        email,
        phone: `${phoneCode} ${phone}`,
        countryCode,
        countryName: selectedCountry?.name || 'India',
        experienceLevel,
        packageSlug: selectedPackage,
        services: servicesToPass,
        preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : preferredGateway
      };
      
      const res = await fetch('/api/public/checkout/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate checkout draft');
      
      setPricingDraft(data);
      setStep(3);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCheckout = () => {
    if (pricingDraft?.paymentUrl) {
      window.location.href = pricingDraft.paymentUrl;
    }
  };
  
  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;
  
  return (
    <div className="min-h-screen bg-brand-bone text-brand-obsidian selection:bg-brand-obsidian selection:text-brand-bone">
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-brand-parchment w-full z-[60]">
        <div 
          className="h-full bg-brand-gold transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {/* Header — same as /inquire */}
      <header className="px-8 md:px-16 lg:px-24 py-8 flex items-center justify-between">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
        <div className="flex items-center gap-2 text-status font-bold tracking-[0.15em] text-brand-obsidian/30 uppercase">
          <span className={`transition-colors duration-300 ${step >= 1 ? 'text-brand-obsidian' : ''}`}>01. Details</span>
          <span className="mx-1 opacity-30">—</span>
          <span className={`transition-colors duration-300 ${step >= 2 ? 'text-brand-obsidian' : ''}`}>02. Services</span>
          <span className="mx-1 opacity-30">—</span>
          <span className={`transition-colors duration-300 ${step === 3 ? 'text-brand-obsidian' : ''}`}>03. Checkout</span>
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════
          STEP 1 — Your Details
      ═══════════════════════════════════════════ */}
      {step === 1 && (
        <main className="px-8 md:px-16 lg:px-24 pt-12 md:pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            
            {/* Left — context */}
            <div className="lg:col-span-4">
              <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-6">
                Step 01
              </p>
              <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-brand-obsidian mb-6 tracking-tight">
                Your Details
              </h1>
              <div className="w-16 h-[1px] bg-brand-gold mb-6" />
              <p className="text-body text-brand-obsidian/50 leading-relaxed max-w-sm">
                Enter your information to generate your career strategy and exact pricing structure.
              </p>
            </div>

            {/* Right — the form */}
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="space-y-10 max-w-lg">
                
                {/* Name */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 placeholder:text-brand-obsidian/15"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 placeholder:text-brand-obsidian/15"
                  />
                </div>

                {/* Phone — mandatory with country code */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Phone
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={phoneCode}
                      onChange={e => {
                        setPhoneCode(e.target.value);
                        const match = COUNTRY_CODES.find(c => c.code === e.target.value);
                        if (match) setCountryCode(match.country);
                      }}
                      className="bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 appearance-none pr-2 w-24 shrink-0"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={`${c.code}-${c.country}`} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="—"
                      className="flex-1 bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 placeholder:text-brand-obsidian/15"
                    />
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Country
                  </label>
                  <select
                    value={countryCode}
                    onChange={e => {
                      setCountryCode(e.target.value);
                      const match = COUNTRY_CODES.find(c => c.country === e.target.value);
                      if (match) setPhoneCode(match.code);
                    }}
                    className="w-full bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 appearance-none"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.country} value={c.country}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Career Stage */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Career Stage
                  </label>
                  <p className="text-metadata text-brand-obsidian/35 mb-5">
                    Pricing scales based on your career stage.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'FRESHER', label: '0–2 Years' },
                      { id: 'MID_CAREER', label: '3–7 Years' },
                      { id: 'EXECUTIVE', label: '8–14 Years' },
                      { id: 'EXECUTIVE_PLUS', label: '15+ Years' }
                    ].map(exp => (
                      <button
                        key={exp.id}
                        onClick={() => setExperienceLevel(exp.id as ClientType)}
                        className={`py-3 px-3 border text-metadata font-bold uppercase tracking-widest transition-all duration-200 ${
                          experienceLevel === exp.id 
                            ? 'bg-brand-obsidian text-brand-bone border-brand-obsidian' 
                            : 'bg-transparent border-brand-parchment text-brand-obsidian/50 hover:border-brand-obsidian/30 hover:text-brand-obsidian/70'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continue */}
                <div className="pt-6 border-t border-brand-parchment">
                  <button 
                    onClick={handleNextStep1}
                    className="inline-flex items-center gap-3 bg-brand-obsidian text-brand-bone px-10 py-4 text-body font-semibold uppercase tracking-[0.1em] hover:bg-brand-graphite transition-colors duration-300"
                  >
                    Continue to Services
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
      
      {/* ═══════════════════════════════════════════
          STEP 2 — Service Selection
      ═══════════════════════════════════════════ */}
      {step === 2 && (
        <main className="px-8 md:px-16 lg:px-24 pt-12 md:pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            
            {/* Left — context */}
            <div className="lg:col-span-4">
              <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-6">
                Step 02
              </p>
              <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-brand-obsidian mb-6 tracking-tight">
                Service<br />Selection
              </h1>
              <div className="w-16 h-[1px] bg-brand-gold mb-6" />
              <p className="text-body text-brand-obsidian/50 leading-relaxed max-w-sm mb-8">
                Select the strategy package that aligns with your career goals.
              </p>
              <div className="flex items-center gap-2 text-metadata text-brand-obsidian/40">
                <Star className="w-3.5 h-3.5 text-brand-gold fill-brand-gold" />
                <span className="uppercase tracking-widest font-bold">Join 500+ placed professionals</span>
              </div>
            </div>

            {/* Right — packages */}
            <div className="lg:col-span-7 lg:col-start-6 space-y-8">
              
              {/* Premium Plus */}
              <div 
                onClick={() => setSelectedPackage('PREMIUM_PLUS')}
                className={`group relative cursor-pointer transition-all duration-200 border ${
                  selectedPackage === 'PREMIUM_PLUS' 
                    ? 'border-brand-gold bg-brand-gold/[0.03]' 
                    : 'border-brand-parchment hover:border-brand-obsidian/20'
                }`}
              >
                <div className="absolute top-0 right-0 bg-brand-obsidian text-brand-bone text-status uppercase tracking-widest font-bold px-4 py-2 flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-brand-gold" /> Recommended
                </div>

                <div className="p-8 sm:p-10">
                  <h3 className="font-serif text-heading text-brand-obsidian mb-2">Premium Plus</h3>
                  <p className="text-body text-brand-obsidian/45 mb-8 pb-6 border-b border-brand-parchment">The complete, end-to-end career branding overhaul.</p>
                  
                  <div className="space-y-5">
                    {[
                      { title: 'Professional Resume', desc: 'ATS-optimized, strategy-driven document meticulously crafted to pass recruiter screening and highlight your unique career trajectory.' },
                      { title: 'LinkedIn Profile Overhaul', desc: 'Complete profile transformation including headline, summary, experience sections, custom banner design, and professional display photo guidance — engineered to attract top recruiters and hiring managers.' },
                      { title: 'Strategic Cover Letter', desc: 'Highly targeted, persuasive narrative designed to secure interviews for your dream roles at top-tier organizations.' },
                      { title: 'Portfolio Website', desc: 'A bespoke, multi-page digital presence that showcases your milestones and professional brand. Includes domain integration setup and domain purchase guidance.' },
                    ].map(svc => (
                      <div key={svc.title} className="flex gap-4">
                        <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-brand-gold' : 'text-brand-parchment'}`} />
                        <div>
                          <p className="font-bold text-brand-obsidian text-body">{svc.title}</p>
                          <p className="text-brand-obsidian/45 text-body mt-1 leading-relaxed">{svc.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Career Booster */}
              <div 
                onClick={() => setSelectedPackage('CAREER_BOOSTER')}
                className={`group relative cursor-pointer transition-all duration-200 border ${
                  selectedPackage === 'CAREER_BOOSTER' 
                    ? 'border-brand-obsidian' 
                    : 'border-brand-parchment hover:border-brand-obsidian/20'
                }`}
              >
                <div className="absolute top-0 right-0 bg-brand-parchment text-brand-obsidian text-status uppercase tracking-widest font-bold px-4 py-2">
                  Popular
                </div>

                <div className="p-8 sm:p-10">
                  <h3 className="font-serif text-heading text-brand-obsidian mb-2">Career Booster</h3>
                  <p className="text-body text-brand-obsidian/45 mb-8 pb-6 border-b border-brand-parchment">Core essentials for career market placement.</p>
                  
                  <div className="space-y-4">
                    {['Professional Resume', 'LinkedIn Profile Overhaul', 'Strategic Cover Letter'].map(title => (
                      <div key={title} className="flex gap-4 items-center">
                        <Check className={`w-5 h-5 shrink-0 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-brand-obsidian' : 'text-brand-parchment'}`} />
                        <p className="font-bold text-brand-obsidian text-body">{title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* A La Carte */}
              <div 
                onClick={() => setSelectedPackage('CUSTOM')}
                className={`group relative cursor-pointer transition-all duration-200 border ${
                  selectedPackage === 'CUSTOM' 
                    ? 'border-brand-obsidian' 
                    : 'border-brand-parchment hover:border-brand-obsidian/20'
                }`}
              >
                <div className="p-8 sm:p-10">
                  <h3 className="font-serif text-heading text-brand-obsidian mb-2">À La Carte</h3>
                  <p className="text-body text-brand-obsidian/45 mb-6">Select individual components tailored to your needs.</p>
                  
                  {selectedPackage === 'CUSTOM' && (
                    <div className="pt-6 border-t border-brand-parchment grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'RESUME', label: 'Professional Resume' },
                        { id: 'LINKEDIN', label: 'LinkedIn Overhaul' },
                        { id: 'COVER_LETTER', label: 'Cover Letter' },
                        { id: 'PORTFOLIO', label: 'Portfolio Website' },
                      ].map(svc => (
                        <button
                          key={svc.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomServices(prev => 
                              prev.includes(svc.id) ? prev.filter(s => s !== svc.id) : [...prev, svc.id]
                            );
                          }}
                          className={`text-left px-5 py-4 border transition-all duration-200 ${
                            customServices.includes(svc.id)
                              ? 'bg-brand-obsidian border-brand-obsidian text-brand-bone'
                              : 'border-brand-parchment text-brand-obsidian/50 hover:border-brand-obsidian/20 hover:text-brand-obsidian/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-body font-medium">{svc.label}</span>
                            {customServices.includes(svc.id) && <Check className="w-4 h-4 text-brand-bone shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment method (non-IN only) */}
              {countryCode !== 'IN' && (
                <div className="pt-8 border-t border-brand-parchment">
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setPreferredGateway('PAYPAL')}
                      className={`text-left px-5 py-4 border transition-all duration-200 ${
                        preferredGateway === 'PAYPAL'
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-parchment hover:border-brand-obsidian/20'
                      }`}
                    >
                      <span className="font-bold text-brand-obsidian text-body block">PayPal</span>
                      <span className="text-metadata text-brand-obsidian/40 mt-1 block">Pay securely in USD</span>
                    </button>
                    <button
                      onClick={() => setPreferredGateway('RAZORPAY')}
                      className={`text-left px-5 py-4 border transition-all duration-200 ${
                        preferredGateway === 'RAZORPAY'
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-parchment hover:border-brand-obsidian/20'
                      }`}
                    >
                      <span className="font-bold text-brand-obsidian text-body block">Credit / Debit Card</span>
                      <span className="text-metadata text-brand-obsidian/40 mt-1 block">Pay in local currency</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6 border-t border-brand-parchment">
                <button 
                  onClick={() => setStep(1)}
                  className="px-8 py-4 border border-brand-parchment text-brand-obsidian/50 font-semibold text-body uppercase tracking-[0.1em] hover:border-brand-obsidian/40 hover:text-brand-obsidian transition-all text-center"
                >
                  Back
                </button>
                <button 
                  onClick={handleNextStep2}
                  disabled={loading}
                  className="flex-1 sm:flex-none sm:ml-auto inline-flex items-center justify-center gap-3 bg-brand-gold text-brand-obsidian px-10 py-4 text-body font-semibold uppercase tracking-[0.1em] hover:bg-[#A37E47] transition-colors duration-300 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate Pricing'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
      
      {/* ═══════════════════════════════════════════
          STEP 3 — Checkout
      ═══════════════════════════════════════════ */}
      {step === 3 && pricingDraft && (
        <main className="px-8 md:px-16 lg:px-24 pt-12 md:pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            
            {/* Left — context */}
            <div className="lg:col-span-4">
              <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-6">
                Step 03
              </p>
              <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-brand-obsidian mb-6 tracking-tight">
                Order<br />Finalization
              </h1>
              <div className="w-16 h-[1px] bg-brand-gold mb-6" />
              <p className="text-body text-brand-obsidian/50 leading-relaxed max-w-sm mb-6">
                Review your investment and proceed to secure checkout.
              </p>
              <div className="flex items-center gap-2 text-metadata text-brand-obsidian/30">
                <Lock className="w-3.5 h-3.5" />
                <span className="uppercase tracking-widest font-bold">Secure 256-bit encryption</span>
              </div>
            </div>

            {/* Right — pricing */}
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="space-y-8">
                
                {/* Itemized breakdown */}
                <div>
                  <p className="text-status font-bold text-brand-obsidian/35 uppercase tracking-[0.15em] mb-6">
                    Itemized Breakdown
                  </p>
                  
                  <div className="space-y-0">
                    <div className="flex justify-between items-center py-5 border-b border-brand-parchment">
                      <span className="font-bold text-brand-obsidian text-body">
                        Services ({selectedPackage.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})
                      </span>
                      <span className="font-serif text-subheading text-brand-obsidian">
                        {pricingDraft.currencySymbol}{pricingDraft.subtotal.toLocaleString()}
                      </span>
                    </div>
                    
                    {pricingDraft.discountAmount > 0 && (
                      <div className="flex justify-between items-center py-5 border-b border-brand-parchment text-brand-gold">
                        <span className="font-bold text-body">Package Adjustment ({(pricingDraft.discountRate * 100).toFixed(0)}%)</span>
                        <span className="font-serif text-subheading">-{pricingDraft.currencySymbol}{pricingDraft.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {pricingDraft.taxAmount > 0 && (
                      <div className="flex justify-between items-center py-5 border-b border-brand-parchment text-brand-obsidian/50">
                        <span className="font-medium text-body">Taxes & Compliance ({(pricingDraft.taxRate * 100).toFixed(0)}%)</span>
                        <span className="font-serif text-subheading">{pricingDraft.currencySymbol}{pricingDraft.taxAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="pt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                    <div>
                      <span className="font-serif text-display-lg text-brand-obsidian">{pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}</span>
                      <span className="text-brand-obsidian/40 text-body ml-3 font-bold">{pricingDraft.currency}</span>
                    </div>
                    <span className="text-status uppercase tracking-widest font-bold text-brand-obsidian/30 max-w-[200px] sm:text-right">
                      Inclusive of all platform fees.
                    </span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex flex-col-reverse sm:flex-row gap-4 pt-8 border-t border-brand-parchment">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-8 py-4 border border-brand-parchment text-brand-obsidian/50 font-semibold text-body uppercase tracking-[0.1em] hover:border-brand-obsidian/40 hover:text-brand-obsidian transition-all text-center"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleCheckout}
                    className="flex-1 group inline-flex items-center justify-center gap-3 bg-brand-obsidian text-brand-bone px-10 py-4 text-body font-semibold uppercase tracking-[0.1em] hover:bg-brand-graphite transition-colors duration-300"
                  >
                    Process Payment
                    <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>

                <p className="text-metadata text-brand-obsidian/25 uppercase tracking-widest leading-relaxed font-bold max-w-md">
                  Access to the client portal is granted immediately upon successful completion. An invoice will be dispatched to your email securely.
                </p>
              </div>
            </div>
          </div>
        </main>
      )}
      
      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-brand-parchment px-8 md:px-16 lg:px-24 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Logo variant="horizontal" size={22} brandId="catalyst" dark={false} />
        <p className="text-status text-brand-obsidian/25 uppercase tracking-[0.15em]">
          © {new Date().getFullYear()} Ripple Nexus · All rights reserved
        </p>
      </footer>
    </div>
  );
}
