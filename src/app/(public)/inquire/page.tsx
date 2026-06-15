'use client';

import React, { useState, useRef } from 'react';
import { Logo } from '@/components/Logo';
import { ArrowRight, Loader2, Check } from 'lucide-react';

/**
 * /inquire — The "Velvet Rope" Lead Capture
 * 
 * Design doctrine (from Catalyst Brand System):
 *  - Bone (#F4F1EB) ground, Obsidian (#0A0B0D) text, Signal Gold (#B8935B) accent
 *  - Asymmetric, left-weighted layout
 *  - Serif headlines (GT Sectra), grotesque body (Söhne)
 *  - No stock imagery. No boxes. No SaaS patterns.
 *  - "The restraint is the signal."
 * 
 * Philosophy: Capture genuine interest in ONE screen. No multi-step wizard.
 *  Name, email, phone, what they're interested in. That's it.
 *  The page itself IS the pitch — the copy does the selling.
 */

const SERVICES = [
  { id: 'RESUME', label: 'Executive Resume' },
  { id: 'LINKEDIN', label: 'LinkedIn Authority' },
  { id: 'COVER_LETTER', label: 'Strategic Cover Letter' },
  { id: 'PORTFOLIO', label: 'Digital Portfolio' },
] as const;

export default function CatalystInquirePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const toggleInterest = (id: string) => {
    setInterests(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/inquire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          countryCode: 'IN',
          countryName: 'India',
          experienceLevel: 'MID_CAREER',
          services: interests.length > 0 ? interests : ['RESUME'],
          packageSlug: interests.length >= 4 ? 'PREMIUM_PLUS' : interests.length >= 3 ? 'CAREER_BOOSTER' : 'CUSTOM',
        })
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-bone flex flex-col">
        {/* Thin gold accent bar */}
        <div className="h-[2px] w-full bg-brand-gold" />
        
        <header className="px-8 md:px-16 lg:px-24 py-8">
          <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
        </header>

        <main className="flex-1 flex items-center px-8 md:px-16 lg:px-24 pb-24">
          <div className="max-w-2xl">
            <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center mb-10">
              <Check className="w-6 h-6 text-brand-gold" />
            </div>
            
            <h1 className="font-serif text-display-lg text-brand-obsidian mb-6 leading-tight">
              We have your details.
            </h1>
            
            <div className="w-16 h-[1px] bg-brand-gold mb-8" />
            
            <p className="text-subheading text-brand-obsidian/60 leading-relaxed max-w-lg mb-6">
              Our strategy team will review your profile and reach out within 24 hours 
              with a tailored recommendation and exclusive pricing.
            </p>
            
            <p className="text-body text-brand-obsidian/40">
              If you need immediate assistance, write to us at{' '}
              <a href="mailto:catalyst@theripplenexus.com" className="text-brand-gold hover:underline">
                catalyst@theripplenexus.com
              </a>
            </p>
          </div>
        </main>

        <footer className="px-8 md:px-16 lg:px-24 py-8 border-t border-brand-parchment">
          <p className="text-status text-brand-obsidian/30 uppercase tracking-widest">
            A Ripple Nexus Institution
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bone text-brand-obsidian selection:bg-brand-obsidian selection:text-brand-bone">
      {/* Thin gold accent bar at very top */}
      <div className="h-[2px] w-full bg-brand-gold" />

      {/* Header — minimal, left-aligned */}
      <header className="px-8 md:px-16 lg:px-24 py-8 flex items-center justify-between">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
        <p className="hidden md:block text-status text-brand-obsidian/30 uppercase tracking-[0.15em]">
          A Ripple Nexus Institution
        </p>
      </header>

      {/* ═══ HERO — Asymmetric, left-weighted ═══ */}
      <section className="px-8 md:px-16 lg:px-24 pt-16 md:pt-24 lg:pt-32 pb-20 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
          
          {/* Left column — the argument (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-6">
            {/* Eyebrow */}
            <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-8">
              Talent Positioning Architecture
            </p>

            <h1 className="font-serif text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] text-brand-obsidian mb-8 tracking-tight">
              Your experience <br className="hidden md:block" />
              is not the product.<br className="hidden md:block" />
              <span className="text-brand-obsidian/40">Your positioning is.</span>
            </h1>
            
            {/* Gold rule */}
            <div className="w-20 h-[1px] bg-brand-gold mb-8" />

            <p className="text-subheading text-brand-obsidian/55 leading-relaxed max-w-md mb-12">
              We engineer how the market perceives your professional value. 
              The resume is an exhaust product of the system — not the product itself.
            </p>

            <button
              onClick={scrollToForm}
              className="group inline-flex items-center gap-3 text-body font-semibold text-brand-obsidian border-b-2 border-brand-gold pb-1 hover:text-brand-gold transition-colors duration-300"
            >
              Request a strategy consultation
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>

          {/* Right column — the proof (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-5 xl:col-start-8 flex flex-col justify-end">
            <div className="border-l border-brand-parchment pl-8 space-y-10">
              {[
                { metric: '500+', label: 'Executives placed into leadership roles' },
                { metric: '94%', label: 'Interview conversion rate for our clients' },
                { metric: '72hr', label: 'Average strategy turnaround' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-serif text-display text-brand-obsidian tracking-tight">{stat.metric}</p>
                  <p className="text-metadata text-brand-obsidian/45 mt-1 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES — Index-style listing ═══ */}
      <section className="border-t border-brand-parchment">
        <div className="px-8 md:px-16 lg:px-24 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            <div className="lg:col-span-4">
              <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-4">
                What We Architect
              </p>
              <h2 className="font-serif text-heading text-brand-obsidian">
                Four instruments<br />of positioning.
              </h2>
            </div>
            
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="divide-y divide-brand-parchment">
                {[
                  {
                    num: '01',
                    title: 'Executive Resume',
                    desc: 'ATS-optimized, strategy-driven document meticulously crafted to pass board-level screening and highlight your unique leadership trajectory.'
                  },
                  {
                    num: '02',
                    title: 'LinkedIn Authority',
                    desc: 'Complete profile overhaul designed to attract elite executive headhunters and establish you as an industry thought-leader.'
                  },
                  {
                    num: '03',
                    title: 'Strategic Cover Letter',
                    desc: 'Highly targeted, persuasive narrative designed to secure interviews for coveted c-suite and director-level roles.'
                  },
                  {
                    num: '04',
                    title: 'Digital Portfolio',
                    desc: 'A bespoke, premium digital presence (domain included) that showcases your career milestones and executive brand.'
                  },
                ].map((svc) => (
                  <div key={svc.num} className="py-8 first:pt-0 last:pb-0 group">
                    <div className="flex items-baseline gap-6">
                      <span className="font-mono text-metadata text-brand-obsidian/25 tabular-nums">{svc.num}</span>
                      <div>
                        <h3 className="font-serif text-subheading text-brand-obsidian group-hover:text-brand-gold transition-colors duration-300">
                          {svc.title}
                        </h3>
                        <p className="text-body text-brand-obsidian/45 mt-2 leading-relaxed max-w-lg">
                          {svc.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FORM — The capture. Minimal. ═══ */}
      <section ref={formRef} className="border-t border-brand-parchment bg-white">
        <div className="px-8 md:px-16 lg:px-24 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
            
            {/* Left — context */}
            <div className="lg:col-span-4">
              <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-4">
                Begin
              </p>
              <h2 className="font-serif text-heading text-brand-obsidian mb-4">
                Tell us who you are.
              </h2>
              <p className="text-body text-brand-obsidian/50 leading-relaxed max-w-sm">
                We will review your profile and respond with a tailored strategy recommendation and pricing within 24 hours.
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

                {/* Phone */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-3">
                    Phone <span className="text-brand-obsidian/25">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="—"
                    className="w-full bg-transparent border-b border-brand-parchment py-3 text-subheading text-brand-obsidian outline-none focus:border-brand-gold transition-colors duration-300 placeholder:text-brand-obsidian/15"
                  />
                </div>

                {/* Interest selection */}
                <div>
                  <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-[0.15em] block mb-5">
                    I am interested in
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SERVICES.map(svc => (
                      <button
                        key={svc.id}
                        onClick={() => toggleInterest(svc.id)}
                        className={`text-left px-5 py-4 border transition-all duration-200 ${
                          interests.includes(svc.id)
                            ? 'border-brand-gold bg-brand-gold/5 text-brand-obsidian'
                            : 'border-brand-parchment text-brand-obsidian/50 hover:border-brand-obsidian/20 hover:text-brand-obsidian/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-body font-medium">{svc.label}</span>
                          {interests.includes(svc.id) && (
                            <Check className="w-4 h-4 text-brand-gold" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !name.trim() || !email.trim()}
                    className="inline-flex items-center gap-3 bg-brand-obsidian text-brand-bone px-10 py-4 text-body font-semibold uppercase tracking-[0.1em] hover:bg-brand-graphite transition-colors duration-300 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Request Consultation
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-metadata text-brand-obsidian/30 mt-4">
                    No commitment. No payment required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
