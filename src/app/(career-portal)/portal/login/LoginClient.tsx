'use client';
// src/app/(career-portal)/portal/login/LoginClient.tsx

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

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
      <div className="text-center py-6">
        <div className="w-12 h-12 border-2 border-[#B8935B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-700 font-semibold">Verifying your link…</p>
        <p className="text-slate-400 text-sm mt-1">You will be redirected in a moment</p>
      </div>
    </PortalShell>
  );

  if (sent) return (
    <PortalShell>
      <div className="text-center">
        <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Check your inbox</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          If <strong className="text-slate-700">{email}</strong> has a CareerPilot account,
          a secure login link has been sent.
        </p>
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
          <p className="text-xs text-slate-600 font-semibold mb-1">Did not receive it?</p>
          <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Link expires in 72 hours</li>
            <li>Allow 1–2 minutes for delivery</li>
          </ul>
        </div>
        <button onClick={() => { setSent(false); setEmail(''); }}
          className="mt-5 text-sm text-[#B8935B] hover:text-[#9A7540] font-medium">
          ← Use a different email
        </button>
      </div>
    </PortalShell>
  );

  return (
    <PortalShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
        <p className="text-slate-500 text-sm mt-1">Access your CareerPilot portal</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        {(['magic', 'pin'] as LoginTab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'magic' ? 'Login Link' : 'PIN Login'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <svg className="flex-shrink-0 mt-0.5" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path stroke="#dc2626" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {tab === 'magic' ? (
        <form onSubmit={requestMagicLink} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] focus:border-transparent bg-slate-50 hover:bg-white transition-colors" />
          </div>
          <button type="submit" disabled={loading || !email}
            className="w-full py-3 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</span>
              : 'Send Login Link'}
          </button>
          <p className="text-center text-xs text-slate-400">We will email you a one-click secure link. No password needed.</p>
        </form>
      ) : (
        <form onSubmit={loginWithPin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] focus:border-transparent bg-slate-50 hover:bg-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">6-Digit PIN</label>
            <input type="password" required inputMode="numeric" maxLength={6}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] focus:border-transparent bg-slate-50 hover:bg-white transition-colors tracking-[0.3em]" />
          </div>
          <button type="submit" disabled={loading || !email || pin.length !== 6}
            className="w-full py-3 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in…</span>
              : 'Sign In with PIN'}
          </button>
          <button type="button" onClick={() => setTab('magic')}
            className="w-full text-center text-xs text-slate-400 hover:text-[#B8935B] transition-colors">
            Forgot PIN? Use login link instead
          </button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400">
          No account?{' '}
          <a href="https://catalyst.theripplenexus.com" target="_blank" rel="noopener noreferrer"
            className="text-[#B8935B] hover:underline font-medium">
            Get a Career Booster package
          </a>
        </p>
      </div>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-[#F5F2EC]/40 to-[#F0EDE6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="https://catalyst.theripplenexus.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border border-slate-200 flex-shrink-0 bg-black flex items-center justify-center">
              <Image src="/logos/catalyst-symbol-dark.svg" width={32} height={32} alt="Catalyst" className="object-contain" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-slate-900 leading-tight tracking-tight group-hover:text-[#9A7540] transition-colors">Catalyst</p>
              <span className="inline-block px-2 py-0.5 bg-[#F0EAE0] text-[#9A7540] text-[10px] font-bold rounded-full tracking-wide mt-0.5">
                CareerPilot
              </span>
            </div>
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8">
          {children}
        </div>
        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>Secure</span><span>·</span><span>Encrypted</span><span>·</span><span>Private</span>
        </div>
      </div>
    </div>
  );
}
