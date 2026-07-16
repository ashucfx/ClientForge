'use client';
// src/components/rn/DeleteClientButton.tsx
// OTP-guarded permanent client deletion: request code → enter code → delete.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteClientButton({ clientId, clientLabel }: { clientId: string; clientLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/delete-otp`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not send OTP');
      setStep('otp');
      setNotice('A 6-digit code was emailed to the admin inbox. Enter it below to confirm.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!/^\d{6}$/.test(otp) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/delete-otp?otp=${otp}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Deletion failed');
      window.location.href = '/rn/clients';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion failed');
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12, color: 'var(--danger)' }} onClick={() => { setOpen(true); setStep('confirm'); setOtp(''); setError(null); setNotice(null); }}>
        Delete Client
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,20,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => !busy && setOpen(false)}>
          <div className="rn-panel" style={{ width: '100%', maxWidth: 440, padding: 24, border: '1px solid var(--danger)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>Delete {clientLabel}?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This permanently removes the client and <strong>all of their data</strong> — projects, milestones,
              messages, deliverables, and logs. This cannot be undone.
            </p>

            {step === 'confirm' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button className="btn-danger" style={{ padding: '9px 18px', fontSize: 13 }} onClick={requestOtp} disabled={busy}>
                  {busy ? 'Sending code…' : 'Email me a deletion code'}
                </button>
              </div>
            ) : (
              <>
                {notice && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{notice}</div>}
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '12px 16px', fontSize: 20, letterSpacing: 8, textAlign: 'center', fontWeight: 800 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={requestOtp} disabled={busy}>Resend code</button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                    <button className="btn-danger" style={{ padding: '9px 18px', fontSize: 13, opacity: /^\d{6}$/.test(otp) ? 1 : 0.5 }} onClick={confirmDelete} disabled={busy || !/^\d{6}$/.test(otp)}>
                      {busy ? 'Deleting…' : 'Permanently Delete'}
                    </button>
                  </div>
                </div>
              </>
            )}
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</div>}
          </div>
        </div>
      )}
    </>
  );
}
