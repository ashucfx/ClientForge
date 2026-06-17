'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { IconChevronRight } from '@/components/Icons';

// ── Service catalog ──────────────────────────────────────────────────────────
const SERVICE_CATALOG = [
  { label: 'Resume — Fresher',        description: 'Resume Writing (Fresher)',             price: 499  },
  { label: 'Resume — Mid-Career',     description: 'Resume Writing (Mid-Career)',           price: 799  },
  { label: 'Resume — Executive',      description: 'Resume Writing (Executive)',            price: 1299 },
  { label: 'Resume — Executive Plus', description: 'Resume Writing (Executive Plus)',       price: 1999 },
  { label: 'LinkedIn — Fresher',      description: 'LinkedIn Optimization (Fresher)',       price: 349  },
  { label: 'LinkedIn — Mid-Career',   description: 'LinkedIn Optimization (Mid-Career)',    price: 549  },
  { label: 'LinkedIn — Executive',    description: 'LinkedIn Optimization (Executive)',     price: 899  },
  { label: 'LinkedIn — Executive Plus',description:'LinkedIn Optimization (Executive Plus)',price: 1299 },
  { label: 'Cover Letter',            description: 'Cover Letter Writing',                 price: 299  },
  { label: 'Portfolio Website',       description: 'Portfolio Website',                    price: 4999 },
  { label: 'Career Consultation',     description: 'Career Consultation (1 hr)',           price: 999  },
  { label: 'ATS Audit & Fix',         description: 'ATS Audit & Fix',                     price: 299  },
  { label: 'Custom',                  description: '',                                     price: 0    },
];

const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'AED', symbol: 'AED' },
  { code: 'SAR', symbol: 'SAR' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

interface LineItemRow {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-700',
  SENT:     'bg-blue-100 text-blue-700',
  VIEWED:   'bg-purple-100 text-purple-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED:  'bg-orange-100 text-orange-700',
};

function newRow(): LineItemRow {
  return { id: crypto.randomUUID(), description: '', qty: 1, unitPrice: 0, lineTotal: 0 };
}

export default function SalesInquiryDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [note, setNote]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [copied, setCopied]     = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── Proposal builder state ──────────────────────────────────────────────────
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMode, setBuilderMode] = useState<'new' | 'revision'>('new');
  const [lineItems, setLineItems]     = useState<LineItemRow[]>([newRow()]);
  const [currency, setCurrency]       = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [discount, setDiscount]       = useState(0);
  const [tax, setTax]                 = useState(0);
  const [title, setTitle]             = useState('');
  const [scopeSummary, setScopeSummary] = useState('');
  const [validUntil, setValidUntil]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const subtotal = lineItems.reduce((s, r) => s + r.lineTotal, 0);
  const total    = subtotal - discount + tax;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/sales/inquiries/${id}`);
    if (res.ok) { const d = await res.json(); setInquiry(d.data); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // ── Line item helpers ───────────────────────────────────────────────────────
  const updateRow = (rowId: string, patch: Partial<LineItemRow>) => {
    setLineItems(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, ...patch };
      updated.lineTotal = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const pickService = (rowId: string, label: string) => {
    const svc = SERVICE_CATALOG.find(s => s.label === label);
    if (!svc) return;
    updateRow(rowId, { description: svc.description || svc.label, unitPrice: svc.price });
  };

  const addRow = () => setLineItems(prev => [...prev, newRow()]);
  const removeRow = (rowId: string) => setLineItems(prev => prev.filter(r => r.id !== rowId));

  const prefillFrom = (proposal: any) => {
    const items: LineItemRow[] = (proposal.lineItems ?? []).map((li: any) => ({
      id: crypto.randomUUID(),
      description: li.description,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
    }));
    setLineItems(items.length ? items : [newRow()]);
    setTitle(proposal.title ?? '');
    setScopeSummary(proposal.scopeSummary ?? '');
    setDiscount(proposal.discount ?? 0);
    setTax(proposal.tax ?? 0);
    const cur = CURRENCY_OPTIONS.find(c => c.code === proposal.currency) ?? CURRENCY_OPTIONS[0];
    setCurrency(cur.code);
    setCurrencySymbol(cur.symbol);
    const d = new Date(); d.setDate(d.getDate() + 14);
    setValidUntil(d.toISOString().split('T')[0]);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const changeStatus = async (status: string) => {
    const res = await fetch(`/api/admin/sales/inquiries/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
    else { const d = await res.json(); toast(d.error ?? 'Status change failed'); }
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

  const submitProposal = async () => {
    const validRows = lineItems.filter(r => r.description.trim() && r.unitPrice > 0);
    if (!validRows.length) { toast('Add at least one service with a price'); return; }
    if (!title.trim())      { toast('Enter a proposal title'); return; }

    setBusy(true);
    const deliverables = validRows.map(r => r.description);
    const res = await fetch(`/api/admin/sales/inquiries/${id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        scopeSummary,
        deliverables,
        lineItems: validRows,
        currency,
        currencySymbol,
        subtotal,
        discount,
        tax,
        total,
        validUntil: new Date(validUntil).toISOString(),
      }),
    });
    if (res.ok) {
      toast('Proposal draft created');
      setShowBuilder(false);
      load();
    } else {
      const d = await res.json();
      toast(d.error ?? 'Create failed');
    }
    setBusy(false);
  };

  const sendProposalAction = async (proposalId: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/sales/proposals/${proposalId}/send`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      copyToClipboard(data.publicUrl);
      toast('Proposal sent — link copied to clipboard');
      load();
    } else toast(data.error ?? 'Send failed');
    setBusy(false);
  };

  const resendProposalAction = async (proposalId: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/sales/proposals/${proposalId}/resend`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      copyToClipboard(data.publicUrl);
      toast('Email resent — link copied to clipboard');
    } else toast(data.error ?? 'Resend failed');
    setBusy(false);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/proposal/${token}`;
    copyToClipboard(url);
    toast('Link copied to clipboard');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createRevision = (proposal: any) => {
    prefillFrom(proposal);
    setBuilderMode('revision');
    setShowBuilder(true);
    setTimeout(() => document.getElementById('proposal-builder')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const startNewProposal = () => {
    setLineItems([newRow()]);
    setTitle('');
    setScopeSummary('');
    setDiscount(0);
    setTax(0);
    setBuilderMode('new');
    setShowBuilder(true);
    setTimeout(() => document.getElementById('proposal-builder')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const createInvoiceAction = async (proposalId: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/sales/inquiries/${id}/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    });
    const data = await res.json();
    if (res.ok) {
      const payUrl = data.data?.paymentUrl;
      if (payUrl) copyToClipboard(payUrl);
      toast(`Invoice created${payUrl ? ' — payment link copied' : ''}`);
      load();
    } else toast(data.error ?? 'Invoice creation failed');
    setBusy(false);
  };

  if (loading || !inquiry) {
    return <AppShell><div className="p-8 text-gray-400">Loading…</div></AppShell>;
  }

  const actions      = STATUS_ACTIONS[inquiry.status] || [];
  const allProposals = (inquiry.proposals ?? []).sort((a: any, b: any) => b.version - a.version);
  const latestProposal = allProposals[0] ?? null;
  const sym = CURRENCY_OPTIONS.find(c => c.code === currency)?.symbol ?? '₹';

  const canBuildProposal = ['QUALIFIED', 'PROPOSAL_SENT', 'APPROVED', 'LOST'].includes(inquiry.status);

  return (
    <AppShell>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toastMsg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/sales/inquiries" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
          ← Back to queue
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">{inquiry.displayId}</h1>
            <p className="text-gray-500 mt-1">{inquiry.name} · {inquiry.email} · {inquiry.phone}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-sm font-medium">
            {inquiry.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Main column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Requirements */}
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

            {/* Proposals history */}
            {allProposals.length > 0 && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-4">Proposals ({allProposals.length})</h2>
                <div className="space-y-3">
                  {allProposals.map((p: any) => (
                    <div key={p.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">v{p.version} — {p.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p.status}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">
                          {p.currencySymbol}{Number(p.total).toLocaleString()}
                        </span>
                      </div>

                      {/* Line items summary */}
                      {(p.lineItems as any[])?.length > 0 && (
                        <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                          {(p.lineItems as any[]).map((li: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span>{li.description} × {li.qty}</span>
                              <span>{p.currencySymbol}{Number(li.lineTotal).toLocaleString()}</span>
                            </div>
                          ))}
                          {p.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>–{p.currencySymbol}{p.discount}</span></div>}
                          {p.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>+{p.currencySymbol}{p.tax}</span></div>}
                        </div>
                      )}

                      {/* Actions per status */}
                      <div className="flex flex-wrap gap-2">
                        {p.status === 'DRAFT' && (
                          <button onClick={() => sendProposalAction(p.id)} disabled={busy}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium disabled:opacity-50">
                            Send to Client
                          </button>
                        )}
                        {['SENT', 'VIEWED'].includes(p.status) && (<>
                          <button onClick={() => copyLink(p.publicToken)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200">
                            Copy Link
                          </button>
                          <button onClick={() => resendProposalAction(p.id)} disabled={busy}
                            className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs rounded-lg font-medium hover:bg-orange-200 disabled:opacity-50">
                            Resend Email
                          </button>
                          <a href={`/proposal/${p.publicToken}`} target="_blank"
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200 inline-flex items-center gap-1">
                            Preview <IconChevronRight className="w-3 h-3" />
                          </a>
                        </>)}
                        {p.status === 'ACCEPTED' && inquiry.status === 'APPROVED' && (
                          <button onClick={() => createInvoiceAction(p.id)} disabled={busy}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg font-medium disabled:opacity-50">
                            Create Invoice
                          </button>
                        )}
                        {['DECLINED', 'EXPIRED'].includes(p.status) && (
                          <button onClick={() => createRevision(p)}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium hover:bg-purple-200">
                            Create Revision
                          </button>
                        )}
                        {['SENT', 'VIEWED', 'ACCEPTED'].includes(p.status) && (
                          <button onClick={() => createRevision(p)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-200">
                            New Revision
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Proposal Builder */}
            {canBuildProposal && (
              <section id="proposal-builder" className="bg-white border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">
                    {showBuilder
                      ? (builderMode === 'revision' ? 'Create Revision' : 'New Proposal Draft')
                      : 'Proposal Builder'}
                  </h2>
                  {!showBuilder && (
                    <button onClick={startNewProposal}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">
                      + New Proposal
                    </button>
                  )}
                  {showBuilder && (
                    <button onClick={() => setShowBuilder(false)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  )}
                </div>

                {!showBuilder && (
                  <p className="text-sm text-gray-400">
                    {latestProposal
                      ? 'Use "New Proposal" above or "New Revision" on an existing proposal.'
                      : 'Click "+ New Proposal" to start building a custom proposal for this inquiry.'}
                  </p>
                )}

                {showBuilder && (
                  <div className="space-y-5">
                    {/* Title + Currency */}
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        className="col-span-2 border rounded-lg px-3 py-2 text-sm"
                        placeholder="Proposal title (e.g. Career Booster — Executive Package)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                      />
                      <select
                        value={currency}
                        onChange={e => {
                          const opt = CURRENCY_OPTIONS.find(c => c.code === e.target.value);
                          setCurrency(opt?.code ?? 'INR');
                          setCurrencySymbol(opt?.symbol ?? '₹');
                        }}
                        className="border rounded-lg px-3 py-2 text-sm"
                      >
                        {CURRENCY_OPTIONS.map(c => (
                          <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                        ))}
                      </select>
                    </div>

                    {/* Line items */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Services / Line Items</div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 w-2/5">Service</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">Qty</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Unit Price</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-500">Total</th>
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {lineItems.map(row => (
                              <tr key={row.id}>
                                <td className="px-3 py-2">
                                  <select
                                    className="w-full text-xs border-0 bg-transparent focus:outline-none"
                                    defaultValue=""
                                    onChange={e => pickService(row.id, e.target.value)}
                                  >
                                    <option value="" disabled>Select service…</option>
                                    {SERVICE_CATALOG.map(s => (
                                      <option key={s.label} value={s.label}>{s.label}</option>
                                    ))}
                                  </select>
                                  <input
                                    className="w-full text-xs mt-1 border-0 border-b border-dashed border-gray-200 bg-transparent focus:outline-none focus:border-blue-400 pb-0.5"
                                    placeholder="Description"
                                    value={row.description}
                                    onChange={e => updateRow(row.id, { description: e.target.value })}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number" min="1" step="1"
                                    className="w-16 border rounded px-2 py-1 text-xs text-center"
                                    value={row.qty}
                                    onChange={e => updateRow(row.id, { qty: parseInt(e.target.value) || 1 })}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400">{sym}</span>
                                    <input
                                      type="number" min="0" step="1"
                                      className="w-24 border rounded px-2 py-1 text-xs"
                                      value={row.unitPrice || ''}
                                      onChange={e => updateRow(row.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-sm font-medium">
                                  {sym}{row.lineTotal.toLocaleString()}
                                </td>
                                <td className="px-2 py-2">
                                  <button onClick={() => removeRow(row.id)}
                                    className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button onClick={addRow}
                          className="w-full px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 text-left border-t">
                          + Add line item
                        </button>
                      </div>
                    </div>

                    {/* Pricing summary */}
                    <div className="ml-auto w-64 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal</span>
                        <span>{sym}{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Discount (–)</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">{sym}</span>
                          <input
                            type="number" min="0" step="1"
                            className="w-20 border rounded px-2 py-1 text-xs text-right"
                            value={discount || ''}
                            onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Tax (+)</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">{sym}</span>
                          <input
                            type="number" min="0" step="1"
                            className="w-20 border rounded px-2 py-1 text-xs text-right"
                            value={tax || ''}
                            onChange={e => setTax(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Total</span>
                        <span>{sym}{total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Scope + Valid Until */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">
                          Scope Summary <span className="normal-case font-normal">(optional — shown to client)</span>
                        </label>
                        <textarea
                          rows={3}
                          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                          placeholder="What's included, approach, expected outcomes…"
                          value={scopeSummary}
                          onChange={e => setScopeSummary(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Valid Until</label>
                        <input
                          type="date"
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          value={validUntil}
                          onChange={e => setValidUntil(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowBuilder(false)}
                        className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={submitProposal} disabled={busy}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {busy ? 'Saving…' : builderMode === 'revision' ? 'Save as New Revision' : 'Save as Draft'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Activity */}
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
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder="Add admin note…"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={addNote} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">
                  Add
                </button>
              </div>
            </section>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Status actions */}
            <section className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Actions</h2>
              <div className="space-y-2">
                {actions.map(a => (
                  <button key={a.status} onClick={() => changeStatus(a.status)}
                    className="w-full px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 text-left">
                    {a.label}
                  </button>
                ))}
                {actions.length === 0 && (
                  <p className="text-xs text-gray-400">No manual transitions available at this stage.</p>
                )}
              </div>
            </section>

            {/* Quick proposal status */}
            {latestProposal && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-1 text-sm">Latest Proposal</h2>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">v{latestProposal.version}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[latestProposal.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {latestProposal.status}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {latestProposal.currencySymbol}{Number(latestProposal.total).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mb-3">{latestProposal.title}</div>

                {latestProposal.sentAt && (
                  <div className="text-xs text-gray-400 mb-3">
                    Sent: {new Date(latestProposal.sentAt).toLocaleDateString()}
                  </div>
                )}

                {/* Quick actions */}
                <div className="space-y-2">
                  {latestProposal.status === 'DRAFT' && (
                    <button onClick={() => sendProposalAction(latestProposal.id)} disabled={busy}
                      className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium disabled:opacity-50">
                      Send to Client
                    </button>
                  )}
                  {['SENT', 'VIEWED'].includes(latestProposal.status) && (
                    <button onClick={() => copyLink(latestProposal.publicToken)}
                      className="w-full px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200">
                      {copied ? 'Copied!' : 'Copy Client Link'}
                    </button>
                  )}
                  {latestProposal.status === 'ACCEPTED' && inquiry.status === 'APPROVED' && (
                    <button onClick={() => createInvoiceAction(latestProposal.id)} disabled={busy}
                      className="w-full px-3 py-2 bg-emerald-600 text-white text-xs rounded-lg font-medium disabled:opacity-50">
                      {busy ? 'Creating…' : 'Create & Send Invoice'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Invoices */}
            {inquiry.invoices?.length > 0 && (
              <section className="bg-white border rounded-xl p-6">
                <h2 className="font-semibold mb-3 text-sm">Invoices</h2>
                {inquiry.invoices.map((inv: any) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}
                    className="flex justify-between items-center text-sm py-1.5 text-blue-600 hover:underline">
                    <span>{inv.invoiceNumber}</span>
                    <span className="text-xs text-gray-400">{inv.status}</span>
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
