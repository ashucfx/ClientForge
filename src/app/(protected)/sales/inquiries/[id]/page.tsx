'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { IconChevronRight } from '@/components/Icons';

const STATUS_ACTIONS: Record<string, { label: string; status: string }[]> = {
  NEW: [{ label: 'Start Review', status: 'UNDER_REVIEW' }],
  UNDER_REVIEW: [
    { label: 'Qualify', status: 'QUALIFIED' },
    { label: 'Request Info', status: 'REQUEST_INFO' },
    { label: 'Reject', status: 'REJECTED' },
  ],
  REQUEST_INFO: [{ label: 'Back to Review', status: 'UNDER_REVIEW' }],
  QUALIFIED: [{ label: 'Mark Lost', status: 'LOST' }],
  APPROVED: [],
  PROPOSAL_SENT: [{ label: 'Mark Lost', status: 'LOST' }],
  INVOICE_SENT: [{ label: 'Mark Lost', status: 'LOST' }],
};

export default function SalesInquiryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [inquiry, setInquiry] = useState<any>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [proposalForm, setProposalForm] = useState({
    title: '',
    scopeSummary: '',
    deliverables: '',
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    currency: 'INR',
    currencySymbol: '₹',
    validUntil: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sales/inquiries/${id}`);
    if (res.ok) {
      const data = await res.json();
      setInquiry(data.data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status: string) => {
    const res = await fetch(`/api/admin/sales/inquiries/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await fetch(`/api/admin/sales/inquiries/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    setNote('');
    load();
  };

  const createProposal = async () => {
    const deliverables = proposalForm.deliverables
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const lineItems = [
      {
        id: crypto.randomUUID(),
        description: proposalForm.title,
        qty: 1,
        unitPrice: proposalForm.subtotal,
        lineTotal: proposalForm.subtotal,
      },
    ];
    const res = await fetch(`/api/admin/sales/inquiries/${id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...proposalForm,
        deliverables,
        lineItems,
        validUntil: proposalForm.validUntil || new Date(Date.now() + 14 * 86400000).toISOString(),
      }),
    });
    if (res.ok) {
      alert('Proposal created');
      load();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  };

  const sendProposal = async (proposalId: string) => {
    const res = await fetch(`/api/admin/sales/proposals/${proposalId}/send`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert(`Client proposal link ready: ${data.publicUrl}`);
      load();
    } else alert(data.error);
  };

  const createInvoice = async (proposalId: string) => {
    const res = await fetch(`/api/admin/sales/inquiries/${id}/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Invoice created. Payment URL: ${data.data?.paymentUrl || 'check invoice admin'}`);
      load();
    } else alert(data.error);
  };

  if (loading || !inquiry) {
    return (
    <AppShell>
      <div className="p-8 text-gray-400">Loading...</div>
    </AppShell>
    );
  }

  const actions = STATUS_ACTIONS[inquiry.status] || [];
  const latestProposal = inquiry.proposals?.[0];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/sales/inquiries" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
          ← Back to queue
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">{inquiry.displayId}</h1>
            <p className="text-gray-500 mt-1">
              {inquiry.name} · {inquiry.email} · {inquiry.phone}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-sm font-medium">
            {inquiry.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Requirements</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd>{inquiry.requirementType?.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Country</dt>
                  <dd>{inquiry.countryName}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Services Requested</dt>
                  <dd>{(inquiry.servicesRequested as string[])?.join(', ')}</dd>
                </div>
                {inquiry.requirementNotes && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="whitespace-pre-wrap mt-1">{inquiry.requirementNotes}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Activity</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(inquiry.activities || []).map((a: any) => (
                  <div key={a.id} className="text-sm border-l-2 border-gray-200 pl-3">
                    <p className="font-medium">{a.action}</p>
                    {a.note && <p className="text-gray-600">{a.note}</p>}
                    <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add admin note..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={addNote} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">
                  Add Note
                </button>
              </div>
            </section>

            {['QUALIFIED', 'PROPOSAL_SENT', 'APPROVED'].includes(inquiry.status) && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-4">Proposal Builder</h2>
                <div className="space-y-3">
                  <input
                    placeholder="Proposal title"
                    value={proposalForm.title}
                    onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Scope summary"
                    rows={4}
                    value={proposalForm.scopeSummary}
                    onChange={(e) =>
                      setProposalForm({ ...proposalForm, scopeSummary: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Deliverables (one per line)"
                    rows={3}
                    value={proposalForm.deliverables}
                    onChange={(e) =>
                      setProposalForm({ ...proposalForm, deliverables: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Subtotal"
                      value={proposalForm.subtotal || ''}
                      onChange={(e) => {
                        const sub = parseFloat(e.target.value) || 0;
                        setProposalForm({
                          ...proposalForm,
                          subtotal: sub,
                          total: sub - proposalForm.discount + proposalForm.tax,
                        });
                      }}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Total"
                      value={proposalForm.total || ''}
                      onChange={(e) =>
                        setProposalForm({ ...proposalForm, total: parseFloat(e.target.value) || 0 })
                      }
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={createProposal}
                    className="px-4 py-2 bg-brand-gold text-white rounded-lg text-sm font-medium"
                  >
                    Create Proposal Draft
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <section className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Actions</h2>
              <div className="space-y-2">
                {actions.map((a) => (
                  <button
                    key={a.status}
                    onClick={() => changeStatus(a.status)}
                    className="w-full px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 text-left"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            {latestProposal && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-2">Latest Proposal v{latestProposal.version}</h2>
                <p className="text-sm text-gray-500 mb-4">{latestProposal.status}</p>
                {latestProposal.status === 'DRAFT' && (
                  <button
                    onClick={() => sendProposal(latestProposal.id)}
                    className="w-full mb-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                  >
                    Mark Sent + Get Link
                  </button>
                )}
                {latestProposal.status === 'ACCEPTED' && inquiry.status === 'APPROVED' && (
                  <button
                    onClick={() => createInvoice(latestProposal.id)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                  >
                    Create Invoice
                  </button>
                )}
                {latestProposal.status === 'SENT' && (
                  <a
                    href={`/proposal/${latestProposal.publicToken}`}
                    target="_blank"
                    className="block text-center text-sm text-blue-600 hover:underline"
                  >
                    View public link <IconChevronRight className="inline w-4 h-4" />
                  </a>
                )}
              </section>
            )}

            {inquiry.invoices?.length > 0 && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-2">Invoices</h2>
                {inquiry.invoices.map((inv: any) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {inv.invoiceNumber} — {inv.status}
                  </Link>
                ))}
              </section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
