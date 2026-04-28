'use client';
// src/app/(career-portal)/portal/setup-pin/page.tsx
// Mandatory PIN setup — shown immediately after first magic-link login

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SetupPinPage() {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [checking, setChecking] = useState(true);

  // Confirm user is authenticated and hasn't set a PIN yet
  useEffect(() => {
    fetch('/api/career/portal/me')
      .then(async res => {
        if (res.status === 401) { router.replace('/portal/login'); return; }
        const data = await res.json() as { name?: string; hasPinSet?: boolean };
        if (data.hasPinSet) { router.replace('/portal/dashboard'); return; }
        setName(data.name ?? '');
        setChecking(false);
      })
      .catch(() => router.replace('/portal/login'));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) { setError('PINs do not match.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/career/auth/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.replace('/portal/dashboard');
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed to set PIN. Please try again.');
      setSaving(false);
    }
  };

  if (checking) return (
    <Shell>
      <div className="text-center py-8">
        <div className="w-10 h-10 border-2 border-[#B8935B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      {/* Lock icon */}
      <div className="flex flex-col items-center mb-7">
        <div className="w-16 h-16 bg-[#FBF8F3] border border-[#E8DDD0] rounded-2xl flex items-center justify-center mb-4">
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24">
            <path stroke="#B8935B" strokeWidth="2" strokeLinecap="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 text-center">Set your access PIN</h2>
        <p className="text-slate-500 text-sm mt-1 text-center leading-relaxed">
          Hi{name ? `, ${name.split(' ')[0]}` : ''}! Create a 6-digit PIN to sign in
          quickly next time — without needing an email link.
        </p>
      </div>

      {/* Mandatory notice */}
      <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <svg className="flex-shrink-0 mt-0.5" width="15" height="15" fill="none" viewBox="0 0 24 24">
          <path stroke="#d97706" strokeWidth="2" strokeLinecap="round"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <p className="text-amber-800 text-xs leading-relaxed">
          <strong>This step is required.</strong> You must set a PIN before accessing your dashboard.
          This keeps your career documents secure.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path stroke="#dc2626" strokeWidth="2" strokeLinecap="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            New 6-Digit PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="w-full px-4 py-3 text-lg border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 hover:bg-white transition-colors tracking-[0.5em] text-center font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Confirm PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="w-full px-4 py-3 text-lg border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 hover:bg-white transition-colors tracking-[0.5em] text-center font-bold"
          />
        </div>

        {/* PIN strength dots */}
        <div className="flex items-center justify-center gap-2 py-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
              i < pin.length ? 'bg-[#B8935B] scale-110' : 'bg-slate-200'
            }`} />
          ))}
        </div>

        <button
          type="submit"
          disabled={saving || pin.length !== 6 || confirm.length !== 6}
          className="w-full py-3 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {saving ? 'Saving…' : 'Set PIN & Go to Dashboard'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400">
        You can change or reset your PIN anytime from your dashboard settings.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-[#F5F2EC]/40 to-[#F0EDE6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <a href="https://catalyst.theripplenexus.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border border-slate-200 flex-shrink-0 bg-black flex items-center justify-center">
              <Image src="/logos/catalyst-symbol-dark.svg" width={32} height={32} alt="Catalyst" className="object-contain" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-slate-900 leading-tight tracking-tight group-hover:text-[#9A7540] transition-colors">Catalyst</p>
              <span className="inline-block px-2 py-0.5 bg-[#F0EAE0] text-[#9A7540] text-[10px] font-bold rounded-full tracking-wide mt-0.5">
                ClientForge Boost
              </span>
            </div>
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8">
          {children}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>Secure</span><span>·</span><span>Encrypted</span><span>·</span><span>Private</span>
        </div>
      </div>
    </div>
  );
}
