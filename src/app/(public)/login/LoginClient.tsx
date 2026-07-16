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
  const [brand, setBrand] = useState<'catalyst' | 'ripple_nexus'>('catalyst');

  // Preselect the portal: an /rn deep link wins, otherwise the last-used portal.
  useEffect(() => {
    if (nextUrl?.startsWith('/rn')) {
      setBrand('ripple_nexus');
      return;
    }
    try {
      const last = localStorage.getItem(LAST_BRAND_KEY);
      if (last === 'ripple_nexus' || last === 'catalyst') setBrand(last);
    } catch { /* ignore */ }
  }, [nextUrl]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, brand }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Login failed');

      const effectiveBrand: string = data.brand ?? brand;
      try { localStorage.setItem(LAST_BRAND_KEY, effectiveBrand); } catch { /* ignore */ }

      // Honor a deep link only if it belongs to the portal we signed into;
      // otherwise use the tenant-aware home from the API.
      const nextMatchesBrand =
        nextUrl && (effectiveBrand === 'ripple_nexus' ? nextUrl.startsWith('/rn') : !nextUrl.startsWith('/rn'));
      const destination = (nextMatchesBrand && nextUrl) || data.redirectTo || '/';
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'var(--bg)',
        backgroundImage: [
          'radial-gradient(ellipse 70% 50% at 20% 10%, rgba(31,86,212,.14), transparent)',
          'radial-gradient(ellipse 60% 45% at 90% 90%, rgba(63,189,139,.10), transparent)',
        ].join(', '),
      }}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-[24px] border"
        style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-2xl)', background: 'var(--surface)' }}
      >
        <div className="grid md:grid-cols-2">
          <div className="relative hidden md:flex flex-col justify-between p-10" style={{ background: 'var(--brand-gradient-soft)' }}>
            <div>
              <div className="flex items-center gap-3">
                <Logo variant="horizontal" size={44} brandId={brand} />
              </div>
              <div className="mt-6" style={{ color: 'var(--text-primary)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
                  {brand === 'catalyst' ? 'Catalyst ClientForge' : 'Ripple Nexus ClientForge'}
                </div>
                <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                  A light, modern admin workspace for {brand === 'catalyst' ? 'Career Booster operations' : 'B2B agency operations'}.
                </div>
              </div>
            </div>

            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              Powered by <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Ripple Nexus</span>
            </div>

            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: [
                  'radial-gradient(circle at 20% 30%, rgba(31,86,212,.18), transparent 55%)',
                  'radial-gradient(circle at 70% 70%, rgba(63,189,139,.14), transparent 60%)',
                ].join(', '),
                opacity: 0.9,
              }}
            />
          </div>

          <div className="p-8 md:p-10">
            <div className="md:hidden flex justify-center mb-6">
              <Logo variant="horizontal" size={42} brandId={brand} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                Admin Sign In
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                Access your private workspace
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: 4, background: 'var(--surface-2)', borderRadius: 12 }}>
              <button
                type="button"
                onClick={() => setBrand('catalyst')}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
                  background: brand === 'catalyst' ? 'var(--surface)' : 'transparent',
                  color: brand === 'catalyst' ? 'var(--brand)' : 'var(--text-secondary)',
                  boxShadow: brand === 'catalyst' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Catalyst
              </button>
              <button
                type="button"
                onClick={() => setBrand('ripple_nexus')}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
                  background: brand === 'ripple_nexus' ? 'var(--surface)' : 'transparent',
                  color: brand === 'ripple_nexus' ? '#7C5CFF' : 'var(--text-secondary)',
                  boxShadow: brand === 'ripple_nexus' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Ripple Nexus
              </button>
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.9px', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
                  Email
                </label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@theripplenexus.com"
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>

              <div className="field">
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.9px', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
                  Password
                </label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  required
                />
              </div>


              {error && (
                <div
                  style={{
                    background: 'var(--error-bg)',
                    border: '1px solid rgba(225,29,72,.22)',
                    color: 'var(--error)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 15 }}>⚠</span>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary w-full"
                style={{
                  justifyContent: 'center',
                  marginTop: 4,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '.2px',
                  background: busy ? 'var(--brand-dark)' : (brand === 'catalyst' ? 'var(--brand-gradient)' : '#7C5CFF'),
                  boxShadow: busy ? 'none' : (brand === 'catalyst' ? '0 10px 28px rgba(31,86,212,.18)' : '0 10px 28px rgba(124,92,255,.2)'),
                }}
                disabled={busy || !password}
              >
                {busy ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite' }}>
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '.3px' }}>
              Catalyst ClientForge · Powered by <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Ripple Nexus</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

