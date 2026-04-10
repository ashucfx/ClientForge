'use client';
// src/app/(protected)/career/page.tsx

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PACKAGE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import type { CareerStatus, CareerPackage } from '@/lib/career/types';

const STATUS_COLORS: Record<CareerStatus, string> = {
  NOT_STARTED:        'bg-slate-100 text-slate-600',
  SUBMITTED:          'bg-blue-100 text-blue-700',
  UNDER_PROCESS:      'bg-amber-100 text-amber-700',
  DRAFT_SENT:         'bg-purple-100 text-purple-700',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-700',
  COMPLETED:          'bg-emerald-100 text-emerald-700',
};

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  packageType: CareerPackage;
  status: CareerStatus;
  amountPaid: number;
  currency: string;
  createdAt: string;
  _count: { forms: number; deliverables: number };
}

export default function CareerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search)       params.set('search', search);
    if (filterStatus)  params.set('status', filterStatus);
    if (filterPackage) params.set('package', filterPackage);

    const res = await fetch(`/api/career/admin/clients?${params}`);
    const data = await res.json() as { clients: Client[]; pagination: { total: number } };
    setClients(data.clients ?? []);
    setTotal(data.pagination?.total ?? 0);
    setLoading(false);
  }, [page, search, filterStatus, filterPackage]);

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
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
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
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {(Object.keys(STATUS_LABELS) as CareerStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterPackage}
          onChange={e => { setFilterPackage(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Packages</option>
          {(Object.keys(PACKAGE_LABELS) as CareerPackage[]).map(p => (
            <option key={p} value={p}>{PACKAGE_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Client', 'Package', 'Status', 'Forms', 'Files', 'Paid', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">Loading…</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">No clients found</td></tr>
            ) : clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-slate-400 text-xs">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{PACKAGE_LABELS[c.packageType]}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{c._count.forms}</td>
                <td className="px-4 py-3 text-slate-600">{c._count.deliverables}</td>
                <td className="px-4 py-3 text-slate-600">
                  {c.currency} {c.amountPaid.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/career/${c.id}`}
                    className="px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
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
  // South Asia
  { code: 'INR', symbol: '₹',   label: 'INR — Indian Rupee' },
  { code: 'PKR', symbol: '₨',   label: 'PKR — Pakistani Rupee' },
  { code: 'BDT', symbol: '৳',   label: 'BDT — Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs',  label: 'LKR — Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'रू',  label: 'NPR — Nepalese Rupee' },
  // Americas
  { code: 'USD', symbol: '$',   label: 'USD — US Dollar' },
  { code: 'CAD', symbol: 'C$',  label: 'CAD — Canadian Dollar' },
  { code: 'BRL', symbol: 'R$',  label: 'BRL — Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', label: 'MXN — Mexican Peso' },
  { code: 'ARS', symbol: '$',   label: 'ARS — Argentine Peso' },
  { code: 'CLP', symbol: '$',   label: 'CLP — Chilean Peso' },
  { code: 'COP', symbol: '$',   label: 'COP — Colombian Peso' },
  { code: 'PEN', symbol: 'S/',  label: 'PEN — Peruvian Sol' },
  // Europe
  { code: 'EUR', symbol: '€',   label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',   label: 'GBP — British Pound' },
  { code: 'CHF', symbol: 'Fr',  label: 'CHF — Swiss Franc' },
  { code: 'NOK', symbol: 'kr',  label: 'NOK — Norwegian Krone' },
  { code: 'SEK', symbol: 'kr',  label: 'SEK — Swedish Krona' },
  { code: 'DKK', symbol: 'kr',  label: 'DKK — Danish Krone' },
  { code: 'PLN', symbol: 'zł',  label: 'PLN — Polish Zloty' },
  { code: 'CZK', symbol: 'Kč',  label: 'CZK — Czech Koruna' },
  { code: 'HUF', symbol: 'Ft',  label: 'HUF — Hungarian Forint' },
  { code: 'RON', symbol: 'lei', label: 'RON — Romanian Leu' },
  { code: 'TRY', symbol: '₺',   label: 'TRY — Turkish Lira' },
  { code: 'RUB', symbol: '₽',   label: 'RUB — Russian Ruble' },
  { code: 'UAH', symbol: '₴',   label: 'UAH — Ukrainian Hryvnia' },
  // Middle East & Africa
  { code: 'AED', symbol: 'د.إ', label: 'AED — UAE Dirham' },
  { code: 'SAR', symbol: '﷼',   label: 'SAR — Saudi Riyal' },
  { code: 'QAR', symbol: 'QR',  label: 'QAR — Qatari Riyal' },
  { code: 'KWD', symbol: 'KD',  label: 'KWD — Kuwaiti Dinar' },
  { code: 'BHD', symbol: 'BD',  label: 'BHD — Bahraini Dinar' },
  { code: 'OMR', symbol: 'ر.ع', label: 'OMR — Omani Rial' },
  { code: 'JOD', symbol: 'JD',  label: 'JOD — Jordanian Dinar' },
  { code: 'EGP', symbol: 'E£',  label: 'EGP — Egyptian Pound' },
  { code: 'NGN', symbol: '₦',   label: 'NGN — Nigerian Naira' },
  { code: 'KES', symbol: 'KSh', label: 'KES — Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R',   label: 'ZAR — South African Rand' },
  { code: 'GHS', symbol: '₵',   label: 'GHS — Ghanaian Cedi' },
  { code: 'MAD', symbol: 'MAD', label: 'MAD — Moroccan Dirham' },
  // Asia Pacific
  { code: 'SGD', symbol: 'S$',  label: 'SGD — Singapore Dollar' },
  { code: 'AUD', symbol: 'A$',  label: 'AUD — Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD — New Zealand Dollar' },
  { code: 'JPY', symbol: '¥',   label: 'JPY — Japanese Yen' },
  { code: 'CNY', symbol: '¥',   label: 'CNY — Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', label: 'HKD — Hong Kong Dollar' },
  { code: 'TWD', symbol: 'NT$', label: 'TWD — Taiwan Dollar' },
  { code: 'KRW', symbol: '₩',   label: 'KRW — South Korean Won' },
  { code: 'MYR', symbol: 'RM',  label: 'MYR — Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',   label: 'THB — Thai Baht' },
  { code: 'IDR', symbol: 'Rp',  label: 'IDR — Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱',   label: 'PHP — Philippine Peso' },
  { code: 'VND', symbol: '₫',   label: 'VND — Vietnamese Dong' },
];

function AddClientModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    packageType: 'RESUME', amountPaid: '', currency: 'INR',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = CURRENCIES.find(c => c.code === form.currency)?.symbol ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/career/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, email: form.email, phone: form.phone || undefined,
        packageType: form.packageType,
        amountPaid: Number(form.amountPaid) || 0,
        currency: form.currency,
      }),
    });
    const data = await res.json() as { error?: string };
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Failed to add client'); return; }
    onAdded();
    onClose();
  };

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Career Client</h2>
            <p className="text-xs text-slate-400 mt-0.5">A welcome email will be sent automatically</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Priya Sharma"
              className={inputCls} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Email Address <span className="text-red-400">*</span></label>
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

          {/* Package */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Package <span className="text-red-400">*</span></label>
            <select value={form.packageType}
              onChange={e => setForm(f => ({ ...f, packageType: e.target.value }))}
              className={inputCls}>
              {(Object.entries(PACKAGE_LABELS) as [CareerPackage, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Currency + Amount — side by side */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Amount Paid</label>
            <div className="flex gap-2">
              {/* Currency selector */}
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-40 flex-shrink-0 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-slate-50 font-semibold text-slate-700"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                ))}
              </select>
              {/* Amount input with currency symbol prefix */}
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

          {/* Submit */}
          <div className="pt-1">
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Adding client…</>
                : <>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 4v16m8-8H4"/></svg>
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
