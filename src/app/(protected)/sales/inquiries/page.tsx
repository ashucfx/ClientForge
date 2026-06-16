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

        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Requirement</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No inquiries found
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{inq.displayId}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{inq.name}</p>
                      <p className="text-gray-500 text-xs">{inq.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {inq.requirementType?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inq.status] || 'bg-gray-100'}`}
                      >
                        {inq.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{inq.priority}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/sales/inquiries/${inq.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Review <IconChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
