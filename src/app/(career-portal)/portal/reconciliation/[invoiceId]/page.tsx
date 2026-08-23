'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

export default function ReconciliationPage() {
  const { invoiceId } = useParams() as { invoiceId: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  // Optionally load invoice details to show what they are reconciling
  // But we'll just keep it simple for now

  useEffect(() => {
    // Just a small delay to simulate loading for smooth entry
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceNumber.trim() || !transferDate) {
      setErrorMsg('Please provide all required fields.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          referenceNumber: referenceNumber.trim(),
          transferDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setErrorMsg(data.error || 'Failed to submit form.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #F8F5F1 0%, #FAF8F4 60%, #F5F1EB 100%)' }}>
        <span className="w-8 h-8 border-4 border-[#B8935B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #F8F5F1 0%, #FAF8F4 60%, #F5F1EB 100%)' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-[#EDE6DA] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-6 text-emerald-500">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Received</h2>
          <p className="text-sm text-slate-500 mb-8">
            Thank you! Your wire transfer reconciliation request has been submitted. Our team will verify the funds and unlock your services shortly.
          </p>
          <button onClick={() => router.push('/portal/login')} className="w-full py-3.5 bg-[#B8935B] text-white font-bold rounded-xl hover:bg-[#9A7540] transition-colors">
            Return to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #F8F5F1 0%, #FAF8F4 60%, #F5F1EB 100%)' }}>
      <div className="bg-white rounded-3xl shadow-xl border border-[#EDE6DA] p-8 max-w-md w-full relative overflow-hidden">
        
        {/* Branding header */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#B8935B]/10 blur-2xl -translate-y-12 translate-x-12 pointer-events-none" />
        
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
            <Image src="/logos/catalyst-symbol-dark.svg" width={24} height={24} alt="Catalyst" className="object-contain" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 leading-tight">Catalyst</p>
            <span className="text-[#B8935B] text-[10px] font-bold uppercase tracking-widest">Reconciliation</span>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Bank Transfer Details</h1>
        <p className="text-sm text-slate-500 mb-6">
          Please provide the reference number for your wire transfer so our team can verify the funds and unlock your package.
        </p>

        {errorMsg && (
          <div className="p-3 mb-6 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Invoice ID</label>
            <input 
              type="text" 
              value={invoiceId}
              disabled
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Transfer Date</label>
            <input 
              type="date" 
              value={transferDate}
              onChange={e => setTransferDate(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Reference Number (UTR / SWIFT ID)</label>
            <input 
              type="text" 
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              required
              placeholder="e.g. 1234567890ABCD"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935B]/50 transition-all"
            />
            <p className="text-xs text-slate-400 mt-1.5">Can be found on your bank transfer receipt.</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3.5 bg-[#B8935B] text-white font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors tracking-wide flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
            ) : (
              'Submit Details'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
