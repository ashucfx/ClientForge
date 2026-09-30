'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';

const LAST_BRAND_KEY = 'cf_last_brand';

/** Only allow same-origin relative paths as post-login destinations. */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return null;
  return raw;
}

export default function LoginClient() {
  const sp = useSearchParams();
  const nextUrl = useMemo(() => safeNextPath(sp.get('next')), [sp]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, brand: 'catalyst' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Login failed');

      const destination = nextUrl || data.redirectTo || '/';
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: '#0A0B0D' }}
    >
      {/* Ambient luxury floating glow orbs */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none motion-glow opacity-30"
        style={{ background: 'radial-gradient(circle, #B8935B 0%, rgba(184,147,91,0) 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[140px] pointer-events-none motion-float opacity-20"
        style={{ background: 'radial-gradient(circle, #3FBD8B 0%, rgba(63,189,139,0) 70%)' }}
      />

      <div
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#2A241C] shadow-2xl relative z-10 motion-scale-in"
        style={{
          boxShadow: '0 30px 80px -15px rgba(0,0,0,0.8), 0 0 0 1px rgba(184,147,91,0.15)',
          background: 'rgba(16, 17, 20, 0.95)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="grid md:grid-cols-2">
          {/* Left Hero Panel */}
          <div
            className="relative hidden md:flex flex-col justify-between p-12 overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #131210 0%, #1A1713 50%, #0D0E10 100%)',
              borderRight: '1px solid rgba(184, 147, 91, 0.15)',
            }}
          >
            {/* Subtle luxury ambient accent inside panel */}
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-25"
              style={{ background: '#B8935B' }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Logo variant="horizontal" size={46} brandId="catalyst" />
              </div>
              <div className="mt-8">
                <span className="inline-block px-3 py-1 bg-[#B8935B]/15 border border-[#B8935B]/30 rounded-full text-[#D4AF7A] text-[11px] font-bold tracking-wider uppercase mb-3">
                  Admin Operations Suite
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
                  Catalyst ClientForge
                </h1>
                <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-sm">
                  Executive workspace for Catalyst client lifecycle, project fulfillment, multi-currency invoicing, and SLA management.
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-400">Catalyst TPA Ecosystem</span>
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="p-8 md:p-12 flex flex-col justify-center bg-[#0F1013]/90">
            <div className="md:hidden flex justify-center mb-6">
              <Logo variant="horizontal" size={42} brandId="catalyst" />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Admin Sign In
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Sign in to access Catalyst admin console
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@theripplenexus.com"
                  autoFocus
                  autoComplete="username"
                  required
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-700/80 bg-slate-900/80 text-white placeholder-slate-500 focus:outline-none input-premium transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    autoComplete="current-password"
                    required
                    className="w-full px-4 py-3 pr-11 text-sm rounded-xl border border-slate-700/80 bg-slate-900/80 text-white placeholder-slate-500 focus:outline-none input-premium transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                    ) : (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="motion-slide-down flex items-center gap-2.5 px-4 py-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
                  <span className="text-base flex-shrink-0">⚠</span>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !password}
                className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold tracking-wide text-white bg-gradient-to-r from-[#B8935B] to-[#9A7540] hover:from-[#C7A26B] hover:to-[#A9834E] shadow-lg shadow-[#B8935B]/20 btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                    <span>Authenticating…</span>
                  </>
                ) : (
                  <span>Sign In →</span>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
              <span>Secure Single Sign-On · Multi-Tenant Catalyst Console</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

