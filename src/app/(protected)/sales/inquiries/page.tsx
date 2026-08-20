'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { IconChevronRight, IconRefresh, IconSearch } from '@/components/Icons';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-purple-100 text-purple-800',
  PROPOSAL_SENT: 'bg-indigo-100 text-indigo-800',
  APPROVED: 'bg-green-100 text-green-800',
  INVOICE_SENT: 'bg-teal-100 text-teal-800',
  CONVERTED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-red-100 text-red-800',
  LOST: 'bg-gray-100 text-gray-600',
  REQUEST_INFO: 'bg-orange-100 text-orange-800',
};

const QUEUE_STATUSES = ['NEW', 'UNDER_REVIEW', 'REQUEST_INFO', 'QUALIFIED', 'PROPOSAL_SENT'];

export default function SalesInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);

  const deleteInquiry = async (id: string, name: string) => {
    if (!confirm(`Permanently delete inquiry from ${name}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/sales/inquiries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInquiries(prev => prev.filter(i => i.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'Delete failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setDeleting(null);
    }
  };

  const fetchInquiries = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/sales/inquiries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.data || []);
        setPagination(data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Review Center</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sales inquiries from /inquire — qualification, proposals, and conversion
            </p>
          </div>
          <button
            onClick={() => fetchInquiries()}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            <IconRefresh className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}
          >
            All
          </button>
          {QUEUE_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative mb-6">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInquiries()}
            placeholder="Search by name, email, or reference..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* ── Mobile Inquiries Card View (< md screens) ── */}
        <div className="block md:hidden space-y-3 mb-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">Loading inquiries...</div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">No inquiries found</div>
          ) : (
            inquiries.map((inq) => (
              <div key={inq.id} className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{inq.name}</div>
                    <div className="text-xs text-slate-500">{inq.email}</div>
                    <div className="font-mono text-[10px] text-slate-400 mt-0.5">{inq.displayId}</div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[inq.status] || 'bg-slate-100'}`}>
                    {inq.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <span>Req: <strong className="text-slate-800">{inq.requirementType?.replace(/_/g, ' ')}</strong></span>
                  <span className="text-[11px] font-bold text-slate-500">Priority: {inq.priority}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <Link
                    href={`/sales/inquiries/${inq.id}`}
                    className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold text-center flex items-center justify-center gap-1 active:scale-98"
                  >
                    Review Inquiry <IconChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => deleteInquiry(inq.id, inq.name)}
                    disabled={deleting === inq.id}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors disabled:opacity-40"
                  >
                    {deleting === inq.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop Inquiries Table View (>= md screens) ── */}
        <div className="hidden md:block bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3.5">Reference</th>
                  <th className="text-left px-5 py-3.5">Contact</th>
                  <th className="text-left px-5 py-3.5">Requirement</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-left px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      No inquiries found
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inq) => (
                    <tr key={inq.id} className="hover:bg-[#FBF8F3]/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 font-bold">{inq.displayId}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900">{inq.name}</p>
                        <p className="text-slate-500 text-xs">{inq.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {inq.requirementType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[inq.status] || 'bg-slate-100'}`}
                        >
                          {inq.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-600">{inq.priority}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/sales/inquiries/${inq.id}`}
                            className="inline-flex items-center gap-1 text-slate-900 font-bold hover:text-[#B8935B] text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            Review <IconChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => deleteInquiry(inq.id, inq.name)}
                            disabled={deleting === inq.id}
                            className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete inquiry"
                          >
                            {deleting === inq.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchInquiries(p)}
                className={`px-3 py-1 rounded text-sm ${p === pagination.page ? 'bg-gray-900 text-white' : 'border'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
