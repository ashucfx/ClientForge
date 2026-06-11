'use client';
// src/app/(protected)/career/page.tsx

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { STATUS_LABELS, SERVICE_LABELS, PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerStatus, CareerServiceSlug, CareerPackage } from '@/lib/career/types';

const STATUS_COLORS: Record<CareerStatus, string> = {
  NOT_STARTED:        'bg-slate-100 text-slate-600',
  SUBMITTED:          'bg-[#F0EAE0] text-[#9A7540]',
  UNDER_PROCESS:      'bg-amber-100 text-amber-700',
  DRAFT_SENT:         'bg-purple-100 text-purple-700',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-700',
  COMPLETED:          'bg-emerald-100 text-emerald-700',
};

const ALL_SERVICES: { slug: CareerServiceSlug; label: string }[] = [
  { slug: 'RESUME',       label: 'Resume Writing' },
  { slug: 'COVER_LETTER', label: 'Cover Letter' },
  { slug: 'LINKEDIN',     label: 'LinkedIn Optimisation' },
  { slug: 'PORTFOLIO',    label: 'Portfolio Website' },
  { slug: 'FULL_PACKAGE', label: 'Career Booster Package' },
  { slug: 'PREMIUM_PLUS', label: 'Premium Plus Package' },
];

interface ServiceInfo { slug: string; name: string }
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  packageType?: string | null;
  services?: { service: ServiceInfo }[];
  status: CareerStatus;
  amountPaid: number;
  currency: string;
  createdAt: string;
  _count: { forms: number; deliverables: number };
  expectedDeliveryAt?: string | null;
  ConversationReadState?: { unreadByAdmin: number; adminSlaDeadline?: string | null } | null;
}

function isCareerBoosterCombo(slugs: string[]): boolean {
  if (slugs.includes('FULL_PACKAGE')) return true;
  return ['RESUME', 'COVER_LETTER', 'LINKEDIN'].every(s => slugs.includes(s));
}

function isPremiumPlusCombo(slugs: string[]): boolean {
  if (slugs.includes('PREMIUM_PLUS')) return true;
  return isCareerBoosterCombo(slugs) && slugs.includes('PORTFOLIO');
}

function clientServiceLabel(c: Client): string {
  if (c.services && c.services.length > 0) {
    const slugs = c.services.map(s => s.service.slug);
    if (isPremiumPlusCombo(slugs)) return 'Premium Plus Package';
    if (isCareerBoosterCombo(slugs)) return 'Career Booster Package';
    return slugs
      .map(slug => SERVICE_LABELS[slug as CareerServiceSlug] ?? slug)
      .join(', ');
  }
  if (c.packageType) {
    return (
      SERVICE_LABELS[c.packageType as CareerServiceSlug] ??
      PACKAGE_LABELS[c.packageType as CareerPackage] ??
      c.packageType
    );
  }
  return '—';
}

export default function CareerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLifecycle, setFilterLifecycle] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    if (filterLifecycle !== 'ALL') params.set('lifecycleStatus', filterLifecycle);

    const res = await fetch(`/api/career/admin/clients?${params}`);
    const data = await res.json() as { clients: Client[]; pagination: { total: number } };
    setClients(data.clients ?? []);
    setTotal(data.pagination?.total ?? 0);
    setLoading(false);
  }, [page, search, filterStatus, filterLifecycle]);

  useEffect(() => { void fetchClients(); }, [fetchClients]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Career Booster Services</h1>
          <p className="text-sm text-slate-500 mt-1">{total} clients total</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#B8935B] text-white text-sm font-semibold rounded-lg hover:bg-[#9A7540] transition-colors"
        >
          + Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#B8935B]"
        />
        <select
          value={filterLifecycle}
          onChange={e => { setFilterLifecycle(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">All Clients</option>
          <option value="ACTIVE">Active Only</option>
          <option value="ARCHIVED">Archived Only</option>
        </select>
        <select 
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Client', 'Status', 'Services', 'SLA Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading…</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No clients found</td></tr>
            ) : clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <Link href={`/career/${c.id}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-2">
                      {c.name}
                      {c.ConversationReadState && c.ConversationReadState.unreadByAdmin > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse shadow-sm shadow-red-500/50">
                          {c.ConversationReadState.unreadByAdmin}
                        </span>
                      )}
                    </Link>
                    <span className="text-sm text-slate-500">{c.email}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="text-sm text-slate-900 line-clamp-2" title={clientServiceLabel(c)}>
                    {clientServiceLabel(c)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    if (c.status === 'COMPLETED') {
                      return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">✔️ Fulfilled</span>;
                    }

                    const effectiveSla = c.ConversationReadState?.adminSlaDeadline || c.expectedDeliveryAt;
                    if (!effectiveSla) return <span className="text-sm text-slate-400">—</span>;

                    const deadline = new Date(effectiveSla);
                    const isBreached = deadline.getTime() < Date.now();
                    const isDueSoon = deadline.getTime() - Date.now() < 2 * 60 * 60 * 1000 && !isBreached;
                    const isCommsSla = !!c.ConversationReadState?.adminSlaDeadline;

                    if (isBreached) {
                      return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700" title={isCommsSla ? "Message SLA" : "Delivery SLA"}>🔴 Breached</span>;
                    }
                    if (isDueSoon) {
                      return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800" title={isCommsSla ? "Message SLA" : "Delivery SLA"}>🟡 Due Soon</span>;
                    }
                    return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700" title={isCommsSla ? "Message SLA" : "Delivery SLA"}>🟢 Healthy</span>;
                  })()}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/career/${c.id}`}
                    className="px-3 py-1 text-xs font-semibold text-[#B8935B] border border-[#E8DDD0] rounded-lg hover:bg-[#FBF8F3] transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > 20 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">
                Previous
              </button>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onAdded={fetchClients} />}
    </div>
  );
}

// ── Add Client Modal ──────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'INR', symbol: '₹',   label: 'INR ₹' },
  { code: 'USD', symbol: '$',   label: 'USD $' },
  { code: 'GBP', symbol: '£',   label: 'GBP £' },
  { code: 'EUR', symbol: '€',   label: 'EUR €' },
  { code: 'AED', symbol: 'د.إ', label: 'AED د.إ' },
  { code: 'SGD', symbol: 'S$',  label: 'SGD S$' },
  { code: 'AUD', symbol: 'A$',  label: 'AUD A$' },
  { code: 'CAD', symbol: 'C$',  label: 'CAD C$' },
  { code: 'SAR', symbol: '﷼',   label: 'SAR ﷼' },
  { code: 'QAR', symbol: 'QR',  label: 'QAR QR' },
  { code: 'PKR', symbol: '₨',   label: 'PKR ₨' },
  { code: 'BDT', symbol: '৳',   label: 'BDT ৳' },
  { code: 'MYR', symbol: 'RM',  label: 'MYR RM' },
  { code: 'ZAR', symbol: 'R',   label: 'ZAR R' },
  { code: 'KES', symbol: 'KSh', label: 'KES KSh' },
  { code: 'NGN', symbol: '₦',   label: 'NGN ₦' },
];

function AddClientModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    amountPaid: '', currency: 'INR', notes: '', invoiceId: ''
  });
  const [selectedServices, setSelectedServices] = useState<Set<CareerServiceSlug>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (slug: CareerServiceSlug) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const currencySymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol ?? '';

  const fetchInvoice = async () => {
    if (!form.invoiceId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/catalyst/invoices?search=${encodeURIComponent(form.invoiceId.trim())}`);
      const data = await res.json() as { invoices?: any[] };
      if (data.invoices && data.invoices.length > 0) {
        const inv = data.invoices[0];
        
        let total = 0;
        if (inv.lineItems && Array.isArray(inv.lineItems)) {
          total = inv.lineItems.reduce((acc: number, item: any) => acc + (Number(item.lineTotal) || 0), 0);
        }
        total = total - (Number(inv.discountAmount) || 0) + (Number(inv.taxAmount) || 0);

        setForm(f => ({
          ...f,
          name: inv.clientName || f.name,
          email: inv.clientEmail || f.email,
          phone: inv.clientPhone || f.phone,
          currency: inv.currency || f.currency,
          amountPaid: total > 0 ? String(total) : f.amountPaid,
          invoiceId: inv.invoiceNumber || f.invoiceId,
        }));
      } else {
        setError('Invoice not found');
      }
    } catch (e) {
      setError('Failed to fetch invoice details');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.size === 0) {
      setError('Select at least one service');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/career/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        services: Array.from(selectedServices),
        amountPaid: Number(form.amountPaid) || 0,
        currency: form.currency,
        notes: form.notes || undefined,
        invoiceId: form.invoiceId || undefined,
      }),
    });
    const data = await res.json() as { error?: string };
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Failed to add client'); return; }
    onAdded();
    onClose();
  };

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B8935B] transition-colors';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Career Client</h2>
            <p className="text-xs text-slate-400 mt-0.5">A welcome email will be sent automatically</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <svg className="text-red-500 flex-shrink-0" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Invoice Mapping */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Invoice Mapping <span className="text-slate-400 font-normal normal-case">optional</span>
            </label>
            <div className="flex gap-2">
              <input type="text" value={form.invoiceId}
                onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))}
                placeholder="e.g. INV-001"
                className={`${inputCls} flex-1`} />
              <button type="button" onClick={fetchInvoice} disabled={!form.invoiceId || loading}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50">
                Fetch
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Enter an invoice number to auto-fill details.</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Priya Sharma"
              className={inputCls} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="client@example.com"
              className={inputCls} />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Phone <span className="text-slate-400 font-normal normal-case">optional</span>
            </label>
            <input type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className={inputCls} />
          </div>

          {/* Services — multi-select checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Services <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {ALL_SERVICES.map(({ slug, label }) => {
                const checked = selectedServices.has(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => toggleService(slug)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                      checked
                        ? 'border-[#B8935B] bg-[#FBF8F3] text-[#9A7540]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      checked ? 'bg-[#B8935B] border-[#B8935B]' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && (
                        <svg width="10" height="10" fill="none" viewBox="0 0 10 10">
                          <path stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5"/>
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            {selectedServices.size > 0 && (
              <p className="text-xs text-[#B8935B] mt-1.5 font-medium">
                {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Currency + Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Amount Paid</label>
            <div className="flex gap-2">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-32 flex-shrink-0 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 font-semibold text-slate-700"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold pointer-events-none select-none">
                  {currencySymbol}
                </span>
                <input
                  type="number" min="0" step="0.01"
                  value={form.amountPaid}
                  onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank or 0 if payment is pending</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Internal Notes <span className="text-slate-400 font-normal normal-case">optional</span>
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes for this client…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || selectedServices.size === 0}
              className="w-full py-3 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#E8DDD0]"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Adding client…</>
                : <>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Client &amp; Send Welcome Email
                  </>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
