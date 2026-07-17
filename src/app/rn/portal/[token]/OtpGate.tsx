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
    <div style={{ 
      background: 'rgba(255,255,255,0.02)', 
      borderTop: '1px solid rgba(124,92,255,0.2)',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,92,255,0.05)',
      borderRadius: 24, 
      padding: '48px', 
      width: '100%', 
      maxWidth: 440, 
      textAlign: 'center',
      backdropFilter: 'blur(20px)'
    }}>
      <Logo variant="horizontal" size={46} dark brandId="ripple_nexus" />
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 32, marginBottom: 12, color: '#FFFFFF', letterSpacing: '-0.5px' }}>Secure Access</h1>
      
      {step === 'IDLE' ? (
        <>
          <p style={{ fontSize: 14, color: '#8B949E', marginBottom: 36, lineHeight: 1.6, fontWeight: 500 }}>
            To protect your agency deliverables and project data, we need to verify your identity.
          </p>
          <button 
            onClick={handleSendOtp} 
            disabled={loading}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 12, border: 'none', 
              background: 'linear-gradient(135deg, #7C5CFF, #38bdf8)', color: '#fff', 
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 8px 24px rgba(124,92,255,0.4)', transition: 'all 0.2s',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <IconMail size={20} />
            {loading ? 'Sending Verification...' : `Send Code to ${email}`}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: '#8B949E', marginBottom: 32, lineHeight: 1.6, fontWeight: 500 }}>
            We&apos;ve sent a 6-digit code to <strong style={{ color: '#fff' }}>{email}</strong>.
          </p>
          <input 
            type="text" 
            placeholder="000000" 
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            style={{ 
              width: '100%', padding: '20px', borderRadius: 12, border: '1px solid rgba(124,92,255,0.3)', 
              background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 28, fontWeight: 800, 
              textAlign: 'center', letterSpacing: 12, marginBottom: 28, outline: 'none',
              boxShadow: 'inset 0 0 0 1px rgba(124,92,255,0.1), 0 0 20px rgba(124,92,255,0.05)', transition: 'all 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#7C5CFF'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(124,92,255,0.3)'}
          />
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 20, fontWeight: 600 }}>{error}</div>}
          <button 
            onClick={handleVerifyOtp} 
            disabled={loading || otp.length !== 6}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 12, border: 'none', 
              background: loading || otp.length !== 6 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7C5CFF, #38bdf8)', 
              color: loading || otp.length !== 6 ? '#8B949E' : '#fff', 
              fontSize: 15, fontWeight: 700, cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
              boxShadow: loading || otp.length !== 6 ? 'none' : '0 8px 24px rgba(124,92,255,0.4)', transition: 'all 0.2s',
              textShadow: loading || otp.length !== 6 ? 'none' : '0 1px 2px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => { if(!loading && otp.length === 6) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {loading ? 'Verifying...' : 'Verify & Access Portal'}
          </button>
          
          <button 
            onClick={handleSendOtp}
            disabled={loading}
            style={{
              background: 'transparent', border: 'none', color: '#8B949E', fontSize: 13, marginTop: 24,
              cursor: loading ? 'not-allowed' : 'pointer', textDecoration: 'underline', fontWeight: 500, transition: '0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
            onMouseOut={(e) => e.currentTarget.style.color = '#8B949E'}
          >
            Resend Code
          </button>
        </>
      )}
    </div>
  );
}
