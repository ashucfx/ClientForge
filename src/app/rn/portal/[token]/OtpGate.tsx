'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMail } from '@/components/Icons';
import { Logo } from '@/components/Logo';

export default function OtpGate({ clientId, email, magicToken }: { clientId: string, email: string, magicToken: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'IDLE' | 'SENT'>('IDLE');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rn/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, magicToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('SENT');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return setError('OTP must be 6 digits');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rn/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, magicToken, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Successfully authenticated! Refresh page to bypass layout guard
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 420, textAlign: 'center' }}>
      <Logo variant="icon" size={48} dark brandId="ripple_nexus" />
      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 24, marginBottom: 8, color: '#F4F5FA' }}>Secure Access</h1>
      
      {step === 'IDLE' ? (
        <>
          <p style={{ fontSize: 14, color: '#A1A1AA', marginBottom: 32, lineHeight: 1.5 }}>
            To protect your agency deliverables and project data, we need to verify your identity.
          </p>
          <button 
            onClick={handleSendOtp} 
            disabled={loading}
            style={{ 
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', 
              background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', color: '#fff', 
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <IconMail size={18} />
            {loading ? 'Sending...' : `Send Code to ${email}`}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: '#A1A1AA', marginBottom: 24, lineHeight: 1.5 }}>
            We&apos;ve sent a 6-digit code to <strong>{email}</strong>.
          </p>
          <input 
            type="text" 
            placeholder="000000" 
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 24, fontWeight: 800, 
              textAlign: 'center', letterSpacing: 8, marginBottom: 24, outline: 'none'
            }}
          />
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</div>}
          <button 
            onClick={handleVerifyOtp} 
            disabled={loading || otp.length !== 6}
            style={{ 
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', 
              background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', color: '#fff', 
              fontSize: 14, fontWeight: 700, cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Verifying...' : 'Verify & Access Portal'}
          </button>
          <button onClick={() => setStep('IDLE')} style={{ background: 'transparent', border: 'none', color: '#A1A1AA', fontSize: 13, marginTop: 24, cursor: 'pointer', textDecoration: 'underline' }}>
            Resend Code
          </button>
        </>
      )}
    </div>
  );
}
