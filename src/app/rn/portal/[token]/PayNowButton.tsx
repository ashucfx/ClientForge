'use client';
// src/app/rn/portal/[token]/PayNowButton.tsx
// Renders the correct pay button based on gateway (Razorpay or PayPal)
// Fetches the payment link from the backend API.

import { useState } from 'react';

export default function PayNowButton({ invoiceId, gateway }: { invoiceId: string; gateway: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rn/invoices/${invoiceId}/payment-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not generate payment link');
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isPayPal = gateway === 'PAYPAL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button
        className={isPayPal ? 'portal-pay-btn-paypal' : 'portal-pay-btn-razorpay'}
        onClick={handlePay}
        disabled={loading}
        style={{ minWidth: 160 }}
      >
        {loading ? (
          <>⏳ Loading…</>
        ) : isPayPal ? (
          <>
            <svg height="16" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.1 3.2C21.6 1.5 18.9 0.6 15.4 0.6H5.6C4.9 0.6 4.2 1.2 4.1 1.9L0.3 25.3C0.2 25.8 0.6 26.3 1.1 26.3H6.8L8.2 17.5L8.1 18C8.2 17.3 8.9 16.7 9.6 16.7H12.4C18.3 16.7 22.9 14.3 24.3 7.4C24.3 7.3 24.4 7.1 24.4 7C24.1 5.3 23.7 4.1 23.1 3.2Z" fill="#003087"/>
              <path d="M24.3 7C22.9 14.3 18.3 16.7 12.4 16.7H9.6C8.9 16.7 8.2 17.3 8.1 18L6.3 29.3C6.2 29.8 6.6 30.3 7.1 30.3H12.1C12.8 30.3 13.4 29.8 13.5 29.1V28.8L14.6 22.1V21.7C14.7 21 15.3 20.5 16 20.5H16.8C21.9 20.5 25.9 18.4 27.1 12.3C27.6 9.7 27.3 7.5 25.9 6C25.5 5.6 25 5.2 24.3 7Z" fill="#0070BA"/>
              <path d="M22.8 6.3C22.6 6.2 22.4 6.1 22.2 6.1C22 6 21.8 6 21.6 5.9C20.8 5.8 19.9 5.8 18.9 5.8H11.8C11.5 5.8 11.3 5.9 11.1 6C10.7 6.2 10.4 6.7 10.3 7.2L8.3 18.8V19C8.4 18.3 9 17.7 9.7 17.7H12.5C18.4 17.7 23 15.3 24.4 8.4C24.4 8.3 24.4 8.1 24.4 8C24.2 7.3 23.6 6.7 22.8 6.3Z" fill="#003087"/>
            </svg>
            Pay with PayPal
          </>
        ) : (
          <>⚡ Pay via Razorpay</>
        )}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: '#F43F5E', maxWidth: 200, textAlign: 'right' }}>{error}</div>
      )}
    </div>
  );
}
