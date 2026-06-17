'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-700',
  SENT:     'bg-blue-100 text-blue-700',
  VIEWED:   'bg-purple-100 text-purple-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED:  'bg-orange-100 text-orange-700',
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');
  const [busy, setBusy]           = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/sales/proposals')
      .then(r => r.json())
      .then(data => { setProposals(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const resend = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/admin/sales/proposals/${id}/resend`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      navigator.clipboard.writeText(data.publicUrl).catch(() => {});
      showToast('Email resent — link copied to clipboard');
      load();
    } else showToast(data.error ?? 'Resend failed');
    setBusy(null);
  };

  const sendDraft = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/admin/sales/proposals/${id}/send`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      navigator.clipboard.writeText(data.publicUrl).catch(() => {});
      showToast('Proposal sent — link copied');
      load();
    } else showToast(data.error ?? 'Send failed');
    setBusy(null);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/proposal/${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    showToast('Link copied to clipboard');
  };

  return (
    <AppShell>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Proposal Center</h1>
          <p className="text-gray-500 text-sm mt-1">
            All proposals across inquiries — send, resend, and track approvals.
          </p>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium text-gray-700">No proposals yet</p>
              <p className="text-sm text-gray-400 mt-1">Proposals are created from the inquiry detail page.</p>
              <Link href="/sales/inquiries" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
                Go to Inquiries →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-left">Proposal</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-left">Client</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-left">Services</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-right">Total</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-center">Status</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-center">Sent</th>
                  <th className="px-5 py-3 font-semibold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proposals.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 text-sm leading-snug">
                        {p.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        v{p.version} · {p.inquiry?.displayId ?? '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-gray-800">{p.inquiry?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{p.inquiry?.email}</div>
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        {(p.lineItems as any[])?.slice(0, 2).map((li: any, i: number) => (
                          <div key={i}>{li.description}</div>
                        ))}
                        {(p.lineItems as any[])?.length > 2 && (
                          <div className="text-gray-400">+{(p.lineItems as any[]).length - 2} more</div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {p.currencySymbol}{Number(p.total).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-gray-400">
                      {p.sentAt ? new Date(p.sentAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Link
                          href={`/sales/inquiries/${p.inquiryId}`}
                          className="text-xs px-2.5 py-1 border rounded text-gray-600 hover:bg-gray-100"
                        >
                          Open
                        </Link>

                        {p.status === 'DRAFT' && (
                          <button
                            onClick={() => sendDraft(p.id)}
                            disabled={busy === p.id}
                            className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Send
                          </button>
                        )}

                        {['SENT', 'VIEWED'].includes(p.status) && (<>
                          <button
                            onClick={() => copyLink(p.publicToken)}
                            className="text-xs px-2.5 py-1 border rounded text-gray-600 hover:bg-gray-100"
                          >
                            Copy Link
                          </button>
                          <button
                            onClick={() => resend(p.id)}
                            disabled={busy === p.id}
                            className="text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        </>)}

                        <a
                          href={`/proposal/${p.publicToken}`}
                          target="_blank"
                          className="text-xs px-2.5 py-1 border rounded text-blue-600 hover:bg-blue-50"
                        >
                          Preview
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
