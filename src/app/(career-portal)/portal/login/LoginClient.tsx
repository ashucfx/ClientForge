'use client';
// src/app/(career-portal)/portal/login/LoginClient.tsx

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';

type LoginTab = 'magic' | 'pin';

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [tab,       setTab]       = useState<LoginTab>('magic');
  const [email,     setEmail]     = useState('');
  const [pin,       setPin]       = useState('');
  const [sent,      setSent]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [verifying, setVerifying] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    setVerifying(true);
    fetch('/api/career/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        if (res.ok) {
          const d = await res.json().catch(() => ({})) as { hasPinSet?: boolean };
          router.replace(d.hasPinSet ? '/portal/dashboard' : '/portal/setup-pin');
          return;
        }
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'This link has expired. Request a new one below.');
        setVerifying(false);
      })
      .catch(() => { setError('Something went wrong. Please try again.'); setVerifying(false); });
  }, [token, router]);

  const requestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/career/auth/magic-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Something went wrong. Please try again.');
        setLoading(false); return;
      }
    } catch { setError('Network error. Please check your connection.'); setLoading(false); return; }
    setLoading(false); setSent(true);
  };

  const loginWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/career/auth/pin-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), pin }),
      });
      if (res.ok) { router.replace('/portal/dashboard'); return; }
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Invalid credentials.');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  if (verifying) return (
    <PortalShell>
      <div className="text-center py-8 motion-scale-in">
        <div className="relative w-14 h-14 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full bg-[#B8935B]/20 blur-md motion-pulse-slow" />
          <div className="relative w-14 h-14 border-2 border-[#B8935B] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-slate-800 font-bold text-base tracking-tight">Verifying your secure link…</p>
        <p className="text-slate-400 text-xs mt-1.5 font-medium">Authenticating your session · Redirecting momentarily</p>
      </div>
    </PortalShell>
  );

  if (sent) return (
    <PortalShell>
      <div role="status" aria-live="polite" className="motion-fade-in-up">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5D4B4] bg-[#FBF8F3] text-[#9A7540]">
          <svg width="25" height="25" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7540]">Sign-in link requested</p>
        <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-[#0A0B0D]">Check your inbox</h2>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">If this address is registered, we’ve sent a secure sign-in link to:</p>
        <p className="mt-3 break-all rounded-xl border border-[#E8DDD0] bg-[#FAF8F4] px-3 py-2.5 text-center text-sm font-semibold text-slate-800">{email}</p>
        <div className="mt-5 rounded-2xl border border-[#E8DDD0] bg-white p-4">
          <p className="text-xs font-bold text-slate-800">If it hasn’t arrived yet</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
            <li>Check your spam or junk folder.</li>
            <li>Allow a minute or two for delivery.</li>
            <li>The link expires after 72 hours.</li>
          </ul>
        </div>
        <button type="button" onClick={() => { setSent(false); setEmail(''); }}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E8DDD0] bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-[#D4AF7A] hover:bg-[#FBF8F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40">
          Use a different email
        </button>
      </div>
    </PortalShell>
  );

  return (
    <PortalShell>
      <div className="mb-6 motion-fade-in-up">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B8935B]/10 border border-[#B8935B]/25 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9A7540]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B] animate-pulse" />
            Client workspace
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[#0A0B0D] tracking-tight sm:text-[28px]">Sign in to your workspace</h2>
        <p className="text-slate-500 text-sm mt-1.5">View your brief, messages, and project files.</p>
      </div>

      <div role="tablist" aria-label="Choose a sign-in method" className="relative flex p-1 bg-[#F4F1EB] rounded-xl mb-6 border border-[#E8DDD0]">
        <button
          type="button"
          onClick={() => { setTab('magic'); setError(''); }}
          role="tab"
          aria-selected={tab === 'magic'}
          className={`relative z-10 flex-1 min-h-10 px-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'magic'
              ? 'bg-white text-[#0A0B0D] shadow-sm'
              : 'text-slate-500 hover:text-[#0A0B0D]'
          }`}>
          Email link
        </button>
        <button
          type="button"
          onClick={() => { setTab('pin'); setError(''); }}
          role="tab"
          aria-selected={tab === 'pin'}
          className={`relative z-10 flex-1 min-h-10 px-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'pin'
              ? 'bg-white text-[#0A0B0D] shadow-sm'
              : 'text-slate-500 hover:text-[#0A0B0D]'
          }`}>
          Security PIN
        </button>
      </div>

      {error && (
        <div className="mb-5 flex gap-2.5 px-4 py-3 bg-red-50/90 border border-red-200 rounded-xl motion-slide-down">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="#dc2626" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-red-700 text-xs font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {tab === 'magic' ? (
        <form onSubmit={requestMagicLink} className="space-y-4 motion-fade-in-up">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Registered email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 text-sm border border-[#E5DAC8] rounded-xl bg-white input-premium text-[#0A0B0D] placeholder:text-slate-400 focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full min-h-12 py-3.5 bg-[#0A0B0D] text-white text-sm font-semibold rounded-xl hover:bg-[#29251E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending Secure Link…</span>
              </span>
            ) : (
              'Send Login Link →'
            )}
          </button>
          <p className="text-center text-xs text-slate-400 leading-normal">
            Passwordless &amp; secure · Authenticated single-use authorization link dispatched to your inbox.
          </p>
        </form>
      ) : (
        <form onSubmit={loginWithPin} className="space-y-4 motion-fade-in-up">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Registered email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 text-sm border border-[#E5DAC8] rounded-xl bg-white input-premium text-[#0A0B0D] placeholder:text-slate-400 focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 shadow-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">6-digit security PIN</label>
              <button
                type="button"
                onClick={() => setTab('magic')}
                className="text-xs text-[#B8935B] hover:text-[#9A7540] font-semibold transition-colors">
                Forgot PIN?
              </button>
            </div>
            <input
              type="password"
              required
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full px-4 py-3 text-sm border border-[#E5DAC8] rounded-xl bg-white input-premium text-[#0A0B0D] tracking-[0.4em] font-mono text-center text-lg focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email || pin.length !== 6}
            className="w-full min-h-12 py-3.5 bg-[#0A0B0D] text-white text-sm font-semibold rounded-xl hover:bg-[#29251E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating…</span>
              </span>
            ) : (
              'Sign In with PIN →'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-[#E8DDD0] text-center">
        <p className="text-xs leading-5 text-slate-500">
          New to Catalyst?{' '}
          <a
            href="/checkout"
            className="text-[#B8935B] hover:text-[#9A7540] underline underline-offset-2 font-bold transition-colors">
            Explore our services →
          </a>
        </p>
      </div>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F7F5F0] text-slate-900 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[#0A0B0D] px-10 py-12 text-white lg:flex xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#B8935B]/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#D4AF7A]/50 to-transparent" />
        <a href="https://catalyst.theripplenexus.com" target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex w-fit items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF7A]/60">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4AF7A]/40 bg-white p-1"><Logo variant="icon" size={36} dark={false} /></span>
          <span>
            <span className="block text-base font-extrabold tracking-[0.16em]">CATALYST</span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF7A]">Client workspace</span>
          </span>
        </a>

        <div className="relative z-10 my-16 max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4AF7A]">Your project, clearly organized</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">Everything for your next career move.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/65">Sign in to follow progress, share your brief, and keep your work with Catalyst in one place.</p>
          <div className="mt-9 grid gap-3">
            {[
              ['01', 'Project overview', 'See progress and recent updates.'],
              ['02', 'Messages and briefs', 'Keep details and conversations together.'],
              ['03', 'Files and invoices', 'Review your project documents.'],
            ].map(([number, label, description]) => (
              <div key={number} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B8935B]/15 text-[10px] font-bold text-[#E6D0A5]">{number}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/90">{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-white/50">{description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">Catalyst TPA · Secure client access</p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-4 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-16">
        <div className="w-full max-w-[440px]">
          <a href="https://catalyst.theripplenexus.com" target="_blank" rel="noopener noreferrer" className="mb-7 inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/50 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E8DDD0] bg-white p-1"><Logo variant="icon" size={34} dark={false} /></span>
            <span>
              <span className="block text-sm font-extrabold tracking-[0.14em] text-[#0A0B0D]">CATALYST</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A7540]">Client workspace</span>
            </span>
          </a>

          <section className="overflow-hidden rounded-3xl border border-[#E8DDD0] bg-white shadow-[0_20px_60px_rgba(26,24,20,.08)]">
            <div aria-hidden="true" className="h-1 bg-gradient-to-r from-[#8B6738] via-[#D4AF7A] to-[#8B6738]" />
            <div className="p-5 sm:p-8">{children}</div>
          </section>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="text-[#9A7540]">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Secure sign-in
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Private client workspace</span>
          </div>
        </div>
      </main>
    </div>
  );
}

