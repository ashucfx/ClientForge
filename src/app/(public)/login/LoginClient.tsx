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
      style={{
        background: 'linear-gradient(135deg, #FAF8F5 0%, #F4EFE6 50%, #ECE4D4 100%)',
      }}
    >
      {/* Ambient luxury light halos */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[100px] pointer-events-none motion-glow opacity-40"
        style={{ background: 'radial-gradient(circle, #B8935B 0%, rgba(184,147,91,0) 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none motion-float opacity-30"
        style={{ background: 'radial-gradient(circle, #D4AF7A 0%, rgba(212,175,122,0) 70%)' }}
      />

      <div
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#E5DAC8] shadow-2xl relative z-10 motion-scale-in"
        style={{
          boxShadow: '0 25px 70px -15px rgba(10,11,13,0.08), 0 1px 3px rgba(10,11,13,0.04)',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="grid md:grid-cols-2">
          {/* Left Hero Panel (Light Luxury Bone / Gold) */}
          <div
            className="relative hidden md:flex flex-col justify-between p-12 overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #FBF9F6 0%, #F6F1E7 60%, #EFE5D4 100%)',
              borderRight: '1px solid #E8DFD0',
            }}
          >
            {/* Subtle luxury ambient accent inside panel */}
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20"
              style={{ background: '#B8935B' }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Logo
                  variant="horizontal"
                  size={48}
                  brandId="catalyst"
                  dark={false}
                  subtitle="Talent Positioning Architecture"
                />
              </div>
              <div className="mt-9">
                <span className="inline-block px-3 py-1 bg-[#F0EAE0] border border-[#B8935B]/30 rounded-full text-[#9A7540] text-[11px] font-bold tracking-wider uppercase mb-3">
                  Admin Operations Suite
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Catalyst ClientForge
                </h1>
                <p className="mt-3 text-slate-600 text-sm leading-relaxed max-w-sm">
                  Executive workspace for Catalyst client lifecycle, project fulfillment, multi-currency invoicing, and SLA management.
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-8 border-t border-[#E8DFD0] flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-600">Catalyst TPA Ecosystem</span>
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-pulse-slow" />
                Operational Rail
              </span>
            </div>
          </div>

          {/* Right Form Panel (Pristine Executive White) */}
          <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
            <div className="md:hidden flex justify-center mb-6">
              <Logo
                variant="horizontal"
                size={42}
                brandId="catalyst"
                dark={false}
                subtitle="Talent Positioning Architecture"
              />
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0EAE0]/70 border border-[#B8935B]/30 text-[#9A7540] text-[10px] font-bold tracking-widest uppercase mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B]" />
                Internal Console Auth
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Admin Sign In
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Authorized credentials required to access client records
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
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
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white text-slate-900 placeholder-slate-400 focus:outline-none input-premium transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
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
                    className="w-full px-4 py-3 pr-11 text-sm rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white text-slate-900 placeholder-slate-400 focus:outline-none input-premium transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                    ) : (
                      <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="motion-slide-down flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  <span className="text-base flex-shrink-0">⚠</span>
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !password}
                className="w-full mt-2 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide text-white bg-gradient-to-r from-[#B8935B] via-[#C9A870] to-[#9A7540] hover:shadow-lg hover:shadow-[#B8935B]/25 btn-press disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                    <span>Authenticating…</span>
                  </>
                ) : (
                  <span>Sign In to ClientForge →</span>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
              <span>Secure Single Sign-On · Multi-Tenant Catalyst Console</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

