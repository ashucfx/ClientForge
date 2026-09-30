'use client';
// src/app/(career-portal)/portal/login/LoginClient.tsx

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
      <div className="text-center motion-scale-in">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-lg motion-pulse-slow" />
          <div className="relative w-16 h-16 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-center shadow-sm">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" className="text-emerald-600 transition-transform duration-300 hover:scale-110">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Check your inbox</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          If <strong className="text-slate-800 font-semibold">{email}</strong> has a registered CareerPilot account,
          a secure one-click magic link has been dispatched.
        </p>
        <div className="mt-5 p-4 bg-slate-50/90 border border-slate-200/80 rounded-2xl text-left shadow-xs">
          <p className="text-xs text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B]" />
            Did not receive it?
          </p>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Link expires securely in 72 hours</li>
            <li>Allow 1–2 minutes for delivery</li>
          </ul>
        </div>
        <button onClick={() => { setSent(false); setEmail(''); }}
          className="mt-6 text-sm text-[#B8935B] hover:text-[#9A7540] font-semibold transition-all hover:underline flex items-center justify-center gap-1.5 mx-auto btn-press">
          <span>←</span>
          <span>Use a different email</span>
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
            Executive Client Portal
          </span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
            Catalyst TPA
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-[#0A0B0D] tracking-tight">Sign in to CareerPilot</h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">Review strategic drafts, manage calibrations, and track career milestones</p>
      </div>

      {/* Luxury Segmented Tabs */}
      <div className="relative flex p-1 bg-[#F4EFE6]/80 rounded-2xl mb-6 border border-[#E5DAC8] shadow-inner">
        <button
          type="button"
          onClick={() => { setTab('magic'); setError(''); }}
          className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 btn-press ${
            tab === 'magic'
              ? 'bg-white text-[#0A0B0D] shadow-sm border border-[#E5DAC8]/70'
              : 'text-slate-500 hover:text-[#0A0B0D]'
          }`}>
          Login Link (Magic)
        </button>
        <button
          type="button"
          onClick={() => { setTab('pin'); setError(''); }}
          className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 btn-press ${
            tab === 'pin'
              ? 'bg-white text-[#0A0B0D] shadow-sm border border-[#E5DAC8]/70'
              : 'text-slate-500 hover:text-[#0A0B0D]'
          }`}>
          PIN Login
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registered Email Address</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 text-sm border border-[#E5DAC8] rounded-xl bg-white input-premium text-[#0A0B0D] placeholder:text-slate-400 focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3.5 bg-gradient-to-r from-[#B8935B] via-[#C9A870] to-[#9A7540] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#B8935B]/30 hover:brightness-105 btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300">
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registered Email Address</label>
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">6-Digit Security PIN</label>
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
            className="w-full py-3.5 bg-gradient-to-r from-[#B8935B] via-[#C9A870] to-[#9A7540] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#B8935B]/30 hover:brightness-105 btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300">
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

      <div className="mt-8 pt-5 border-t border-[#E5DAC8]/60 text-center">
        <p className="text-xs text-slate-500">
          Ready to elevate your executive trajectory?{' '}
          <a
            href="/checkout"
            className="text-[#B8935B] hover:text-[#9A7540] underline underline-offset-2 font-bold transition-colors">
            Get started with CareerPilot →
          </a>
        </p>
      </div>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#FAFAF8] via-[#F4EFE6]/60 to-[#ECE6D8] flex items-center justify-center p-4">
      {/* Ambient luxury lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#B8935B]/10 rounded-full blur-3xl pointer-events-none motion-float" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#D4AF7A]/15 rounded-full blur-3xl pointer-events-none motion-float delay-200" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.7),transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 motion-scale-in">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <a
            href="https://catalyst.theripplenexus.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center group btn-press focus:outline-none"
          >
            {/* Medallion & Wordmark Lockup */}
            <div className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl bg-white/90 border border-[#E5DAC8] shadow-sm backdrop-blur-md group-hover:border-[#B8935B]/60 group-hover:shadow-md transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#FAF8F5] to-[#ECE5D8] border border-[#D4AF7A]/40 flex items-center justify-center shadow-xs flex-shrink-0">
                <Logo variant="icon" size={32} dark={false} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-black text-xl text-[#0A0B0D] tracking-[0.16em] uppercase">
                    CATALYST
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#B8935B]/10 text-[#9A7540] border border-[#B8935B]/25 text-[9px] font-extrabold uppercase tracking-wider">
                    CAREERPILOT
                  </span>
                </div>
                <p className="text-[9.5px] font-extrabold text-[#9A7540] uppercase tracking-[0.24em] mt-0.5">
                  Talent Positioning Architecture
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Luxury Glass Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 border border-[#EDE4D3] p-7 sm:p-9 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#B8935B] to-transparent" />
          {children}
        </div>

        {/* Security badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="text-emerald-600">
              <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            256-Bit SSL Encrypted
          </span>
          <span className="text-slate-300">·</span>
          <span>Zero-Knowledge Auth</span>
          <span className="text-slate-300">·</span>
          <span className="text-[#9A7540] font-bold">Catalyst TPA</span>
        </div>
      </div>
    </div>
  );
}

