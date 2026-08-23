'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { IconAlert, IconTarget } from '@/components/Icons';

export default function RnReconciliationPage() {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  const handleMatch = async () => {
    if (!invoiceNumber.trim()) {
      setError('Please enter an Invoice Number or Reference ID.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. First, search for the invoice to get its ID
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(invoiceNumber)}&type=invoice`);
      const searchData = await searchRes.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        throw new Error(`Could not find invoice matching "${invoiceNumber}"`);
      }

      const invoiceId = searchData.results[0].id;
      const actualInvoiceNumber = searchData.results[0].title;

      // 2. Mark it as paid
      const markRes = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid' }),
      });
      
      const markData = await markRes.json();
      
      if (!markRes.ok) {
        throw new Error(markData.error ?? 'Failed to mark as paid');
      }

      setSuccessMsg(`Successfully reconciled and marked ${actualInvoiceNumber} as PAID! Confirmation emails sent.`);
      setInvoiceNumber('');
      
    } catch (e: any) {
      setError(e.message || 'Reconciliation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RippleNexusShell>
      <main className="page-body">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
            Bank Transfer Reconciliation
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            Manually match incoming wire transfers to invoices.
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div className="w-12 h-12 bg-[#7C5CFF]/10 text-[#7C5CFF] rounded-xl flex items-center justify-center">
              <IconTarget />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Match Payment Reference</h2>
              <p className="text-sm text-slate-500">Enter the invoice number provided by the client in their wire transfer details.</p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-sm font-medium flex items-center gap-3 mb-6">
              <IconAlert /> {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-sm font-medium flex items-center gap-3 mb-6 border border-emerald-200 shadow-sm">
              <span className="text-lg">✅</span> {successMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Reference / Invoice Number</label>
              <input 
                type="text" 
                className="input w-full font-mono text-lg" 
                placeholder="e.g., RN-2026-0042" 
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMatch()}
              />
            </div>

            <button 
              className="w-full py-4 bg-[#7C5CFF] hover:bg-[#6A48F5] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              onClick={handleMatch}
              disabled={loading || !invoiceNumber.trim()}
            >
              {loading ? 'Processing...' : 'Mark as PAID & Send Emails'}
            </button>
          </div>

          <div className="mt-8 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed">
            <strong>How it works:</strong> When you click the button above, the system will automatically:
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li>Change the invoice status to <span className="font-bold text-emerald-600">PAID</span></li>
              <li>Dispatch the standard Payment Confirmation email to the client</li>
              <li>Send the Internal Payment Alert to the admin team</li>
              <li>Trigger any automated onboarding workflows associated with the invoice</li>
            </ul>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
