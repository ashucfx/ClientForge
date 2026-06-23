'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ArrowRight, Loader2, Check } from 'lucide-react';
import { INQUIRE_SERVICES, INQUIRE_ONLY_REQUIREMENT_TYPES } from '@/lib/catalog/self-service';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const REQUIREMENT_LABELS: Record<string, string> = {
  CUSTOM_PACKAGE: 'Custom Career Package',
  ENTERPRISE: 'Team / Enterprise Solutions',
  OTHER: 'Other Request',
};

export default function CatalystInquirePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [countryName, setCountryName] = useState('India');
  const [requirementType, setRequirementType] = useState<string>('CUSTOM_PACKAGE');
  const [interests, setInterests] = useState<string[]>([]);
  const [requirementNotes, setRequirementNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [displayId, setDisplayId] = useState('');
  const [website] = useState('');
  const [startedAt] = useState(() => Date.now());
  const formRef = useRef<HTMLDivElement>(null);

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    if (interests.length === 0) return alert('Select at least one area of interest.');
    setLoading(true);
    try {
      const res = await fetch('/api/public/inquire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: `+${phone}`,
          countryCode,
          countryName,
          requirementType,
          servicesRequested: interests,
          requirementNotes: requirementNotes.trim() || undefined,
          sourceUrl: window.location.href,
          website,
          startedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setDisplayId(data.displayId || '');
      setSubmitted(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-bone flex flex-col">
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
              Inquiry received.
            </h1>
            <div className="w-16 h-[1px] bg-brand-gold mb-8" />
            {displayId && (
              <p className="text-body font-mono text-brand-gold mb-4">Reference: {displayId}</p>
            )}
            <p className="text-subheading text-brand-obsidian/60 leading-relaxed max-w-lg mb-6">
              Our team will review your requirements and respond within 24–48 hours with a
              tailored proposal and next steps. No payment is required at this stage.
            </p>
            <p className="text-body text-brand-obsidian/40 mb-8">
              Need standard packages with instant checkout?{' '}
              <Link href="/checkout" className="text-brand-gold hover:underline">
                Get started today →
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bone text-brand-obsidian">
      <div className="h-[2px] w-full bg-brand-gold" />
      <header className="px-8 md:px-16 lg:px-24 py-8 flex items-center justify-between">
        <Logo variant="horizontal" size={28} brandId="catalyst" dark={false} />
        <Link
          href="/checkout"
          className="text-status uppercase tracking-widest text-brand-obsidian/40 hover:text-brand-gold transition-colors"
        >
          Self-service checkout →
        </Link>
      </header>

      <section className="px-8 md:px-16 lg:px-24 pt-16 pb-12">
        <p className="text-status text-brand-gold uppercase tracking-[0.2em] font-bold mb-6">
          Custom Inquiry
        </p>
        <h1 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] max-w-3xl mb-6">
          Tell us what you need.
        </h1>
        <div className="w-20 h-[1px] bg-brand-gold mb-8" />
        <p className="text-subheading text-brand-obsidian/55 max-w-xl leading-relaxed">
          For executive positioning, complex career situations, agency projects, and custom
          engagements. Submit your requirements and we&apos;ll respond with a tailored proposal.
        </p>
      </section>

      <section ref={formRef} className="border-t border-brand-parchment bg-white">
        <div className="px-8 md:px-16 lg:px-24 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <h2 className="font-serif text-heading mb-4">Submit Your Inquiry</h2>
              <p className="text-body text-brand-obsidian/50">
                Name, contact details, and what you need. We&apos;ll review and follow up with a
                tailored proposal — no calls required.
              </p>
            </div>
            <div className="lg:col-span-7 lg:col-start-6 space-y-8 max-w-lg">
              <Field label="Full Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-underline"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-underline"
                />
              </Field>
              <Field label="Mobile Number">
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
                    placeholder="Enter mobile number"
                  />
                </div>
              </Field>
              <Field label="Requirement Type">
                <select
                  value={requirementType}
                  onChange={(e) => setRequirementType(e.target.value)}
                  className="input-underline"
                >
                  {INQUIRE_ONLY_REQUIREMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {REQUIREMENT_LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Areas of Interest">
                <div className="space-y-3 pt-2">
                  {INQUIRE_SERVICES.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleInterest(svc.id)}
                      className={`w-full text-left p-4 border transition-colors ${
                        interests.includes(svc.id)
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-brand-parchment hover:border-brand-obsidian/20'
                      }`}
                    >
                      <p className="font-semibold text-body">{svc.label}</p>
                      <p className="text-metadata text-brand-obsidian/45 mt-1">{svc.sub}</p>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tell us about your situation">
                <textarea
                  value={requirementNotes}
                  onChange={(e) => setRequirementNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-brand-parchment p-3 text-body outline-none focus:border-brand-gold"
                  placeholder="Timeline, goals, complexity, any context that helps us assess fit..."
                />
              </Field>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-3 bg-brand-obsidian text-brand-bone px-10 py-4 text-body font-semibold uppercase tracking-widest hover:bg-brand-graphite disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Submit Inquiry
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
      <style jsx global>{`
        .input-underline {
          width: 100%;
          background: transparent;
          border-bottom: 1px solid #e8e4dc;
          padding: 0.75rem 0;
          font-size: 1.125rem;
          outline: none;
        }
        .input-underline:focus {
          border-color: #b8935b;
        }
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-status font-bold text-brand-obsidian/50 uppercase tracking-widest block mb-3">
        {label}
      </label>
      {children}
    </div>
  );
}
