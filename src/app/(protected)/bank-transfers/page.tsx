'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';

interface TransferRequest {
  id: string;
  invoiceId: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  amount: number;
  referenceNumber: string;
  transferDate: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
}

export default function ReconciliationsPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reconciliations?status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) setRequests(data.requests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleVerify = async (id: string) => {
    if (!confirm('Are you sure you want to verify this payment? This will mark the invoice as PAID and trigger client onboarding.')) {
      return;
    }
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/admin/reconciliations/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'VERIFIED' } : r));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to verify');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to REJECT this payment request? The invoice will remain unpaid.')) {
      return;
    }
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/admin/reconciliations/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reject');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Transfer Reconciliations</h1>
            <p className="text-sm text-slate-500 mt-1">Review and verify offline wire transfers from international clients.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/60">
            {(['PENDING', 'VERIFIED', 'ALL'] as const).map(s => (
              <button key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Date / Ref</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No requests found.</td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{req.clientName}</div>
                        <div className="text-xs text-slate-500">{req.clientEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700">{new Date(req.transferDate).toLocaleDateString()}</div>
                        <div className="text-xs font-mono text-slate-500">Ref: {req.referenceNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{req.currency} {req.amount.toLocaleString()}</span>
                        <div className="text-xs text-blue-500 hover:underline mt-0.5">
                          <Link href={`/invoices/${req.invoiceId}`}>View Invoice</Link>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          req.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={verifyingId === req.id}
                              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleVerify(req.id)}
                              disabled={verifyingId === req.id}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                            >
                              {verifyingId === req.id ? 'Verifying...' : 'Verify Funds'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
