'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  IconChevronRight,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconCopy,
  IconCheck,
  IconMail,
  IconPhone,
  IconBriefcase,
  IconTarget,
  IconAlert,
  IconX,
  IconDocument,
} from '@/components/Icons';

interface SalesInquiryItem {
  id: string;
  displayId: string;
  name: string;
  email: string;
  phone?: string | null;
  countryCode: string;
  countryName: string;
  requirementType: string;
  servicesRequested: string[];
  requirementNotes?: string | null;
  autoQualScore?: number | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'NEW' | 'UNDER_REVIEW' | 'REQUEST_INFO' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'APPROVED' | 'INVOICE_SENT' | 'CONVERTED' | 'REJECTED' | 'LOST';
  createdAt: string;
  updatedAt: string;
  proposals?: any[];
  activities?: any[];
}

interface InquiriesSummary {
  total: number;
  newCount: number;
  underReviewCount: number;
  qualifiedCount: number;
  proposalSentCount: number;
  convertedCount: number;
  rejectedLostCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  NEW:           { label: 'New Lead',       bg: 'bg-amber-50',     text: 'text-amber-800',   dot: 'bg-amber-500',   border: 'border-amber-200/80' },
  UNDER_REVIEW:  { label: 'Under Review',   bg: 'bg-blue-50',      text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200/80' },
  REQUEST_INFO:  { label: 'Info Requested', bg: 'bg-orange-50',    text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-200/80' },
  QUALIFIED:     { label: 'Qualified',      bg: 'bg-purple-50',    text: 'text-purple-700',  dot: 'bg-purple-500',  border: 'border-purple-200/80' },
  PROPOSAL_SENT: { label: 'Proposal Sent',  bg: 'bg-indigo-50',    text: 'text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-indigo-200/80' },
  APPROVED:      { label: 'Approved',       bg: 'bg-teal-50',      text: 'text-teal-700',    dot: 'bg-teal-500',    border: 'border-teal-200/80' },
  INVOICE_SENT:  { label: 'Invoice Sent',   bg: 'bg-sky-50',       text: 'text-sky-700',     dot: 'bg-sky-500',     border: 'border-sky-200/80' },
  CONVERTED:     { label: 'Converted',      bg: 'bg-emerald-50',   text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-200/80' },
  REJECTED:      { label: 'Rejected',       bg: 'bg-rose-50',      text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-200/80' },
  LOST:          { label: 'Lost',           bg: 'bg-slate-100',    text: 'text-slate-600',   dot: 'bg-slate-400',   border: 'border-slate-200' },
};

const PRIORITY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  HIGH:   { label: 'High Priority',   bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
  MEDIUM: { label: 'Medium Priority', bg: 'bg-[#FBF8F3]', text: 'text-[#9A7540]', border: 'border-[#EAE2D5]' },
  LOW:    { label: 'Standard',        bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
};

const FILTER_TABS = [
  { key: '', label: 'All Inquiries' },
  { key: 'NEW', label: 'New Leads' },
  { key: 'UNDER_REVIEW', label: 'In Review' },
  { key: 'QUALIFIED', label: 'Qualified' },
  { key: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { key: 'CONVERTED', label: 'Converted' },
  { key: 'LOST', label: 'Lost / Closed' },
];

export default function SalesInquiriesPage() {
  const [inquiries, setInquiries] = useState<SalesInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [summary, setSummary] = useState<InquiriesSummary>({
    total: 0,
    newCount: 0,
    underReviewCount: 0,
    qualifiedCount: 0,
    proposalSentCount: 0,
    convertedCount: 0,
    rejectedLostCount: 0,
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copyToClipboard = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    showToast(`${label} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const fetchInquiries = useCallback(async (page = 1, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/sales/inquiries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.data || []);
        if (data.pagination) setPagination(data.pagination);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      showToast('Network error loading inquiries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchInquiries(1);
  }, [fetchInquiries]);

  const deleteInquiry = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete lead from "${name}"? This cannot be recovered.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/sales/inquiries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInquiries(prev => prev.filter(i => i.id !== id));
        showToast(`Inquiry for ${name} removed`);
        fetchInquiries(pagination.page, false);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete inquiry');
      }
    } catch {
      showToast('Network error deleting inquiry');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#121212] text-white text-xs font-semibold rounded-xl shadow-2xl border border-white/10 animate-fadeSlideIn">
          <IconCheck className="w-4 h-4 text-[#B8935B]" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8935B]" />
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
                Sales &amp; Inquiry Hub
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direct inquiries submitted from <span className="font-mono text-slate-700 font-semibold">/inquire</span> — qualification, proposals, and customer conversion
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sales/proposals"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-[#FBF8F3] hover:border-[#B8935B]/40 transition-all shadow-xs"
            >
              <IconDocument className="w-3.5 h-3.5 text-[#B8935B]" />
              Proposal Center
            </Link>

            <button
              onClick={() => fetchInquiries(pagination.page, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs disabled:opacity-50"
              title="Refresh Inquiries"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#B8935B]' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* ── KPI Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <IconBriefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
              {summary.total || pagination.total}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Inbound career &amp; enterprise leads
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#FBF8F3] border border-[#B8935B]/30 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#9A7540] uppercase tracking-wider">Action Needed</span>
              <div className="w-8 h-8 rounded-xl bg-[#B8935B]/15 flex items-center justify-center text-[#B8935B]">
                <IconAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#9A7540]">
              {summary.newCount}
            </div>
            <div className="mt-1 text-[11px] text-[#9A7540]/80">
              Unreviewed new submissions
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Pipeline</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <IconTarget className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
              {summary.underReviewCount + summary.qualifiedCount + summary.proposalSentCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Reviewing, qualified &amp; proposals
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Converted Clients</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <IconCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-700">
              {summary.convertedCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Successfully paid &amp; converted
            </div>
          </div>
        </div>

        {/* ── Filter Bar & Search ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInquiries(1)}
                placeholder="Search by client name, email, country, or reference ID..."
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); fetchInquiries(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchInquiries(1)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Search
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-slate-100">
            {FILTER_TABS.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.key === '' && summary.total > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {summary.total}
                    </span>
                  )}
                  {tab.key === 'NEW' && summary.newCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'}`}>
                      {summary.newCount}
                    </span>
                  )}
                  {tab.key === 'QUALIFIED' && summary.qualifiedCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-purple-300 text-purple-950' : 'bg-purple-100 text-purple-800'}`}>
                      {summary.qualifiedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Inquiries List View ── */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
            <IconRefresh className="w-6 h-6 animate-spin text-[#B8935B]" />
            <p className="text-sm font-semibold text-slate-500">Loading inquiries and proposals...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <IconBriefcase className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No inquiries found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || statusFilter
                ? 'No leads match the current filters. Try changing your search query or reset status filters.'
                : 'Inquiries submitted by prospective clients on /inquire will automatically appear here.'}
            </p>
            {(search || statusFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter(''); }}
                className="mt-2 text-xs font-bold text-[#B8935B] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (md and up) */}
            <div className="hidden md:block bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Reference</th>
                      <th className="px-5 py-3.5">Contact Profile</th>
                      <th className="px-5 py-3.5">Requirement / Scope</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Priority</th>
                      <th className="px-5 py-3.5">Received</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inquiries.map((inq) => {
                      const st = STATUS_CONFIG[inq.status] || STATUS_CONFIG.NEW;
                      const pri = PRIORITY_BADGES[inq.priority] || PRIORITY_BADGES.MEDIUM;
                      const isNew = inq.status === 'NEW';

                      return (
                        <tr
                          key={inq.id}
                          className={`hover:bg-[#FBF8F3]/60 transition-colors ${
                            isNew ? 'bg-amber-50/30 font-medium' : ''
                          }`}
                        >
                          {/* Reference ID */}
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                {inq.displayId}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inq.displayId, inq.id, 'Reference')}
                                className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Copy Reference ID"
                              >
                                {copiedId === inq.id ? (
                                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <IconCopy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {inq.countryName || inq.countryCode}
                            </span>
                          </td>

                          {/* Contact Info */}
                          <td className="px-5 py-4 align-top">
                            <div className="font-bold text-slate-900 text-sm">{inq.name}</div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <IconMail className="w-3 h-3 text-slate-400" />
                              <a href={`mailto:${inq.email}`} className="hover:text-slate-900 underline-offset-2 hover:underline">
                                {inq.email}
                              </a>
                            </div>
                            {inq.phone && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 font-mono">
                                <IconPhone className="w-3 h-3 text-slate-400" />
                                <span>{inq.phone}</span>
                              </div>
                            )}
                          </td>

                          {/* Requirement */}
                          <td className="px-5 py-4 align-top">
                            <div className="font-semibold text-slate-800 text-xs uppercase tracking-wide">
                              {inq.requirementType?.replace(/_/g, ' ')}
                            </div>
                            {inq.servicesRequested && inq.servicesRequested.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {inq.servicesRequested.slice(0, 3).map((srv, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                                  >
                                    {srv.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {inq.servicesRequested.length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-semibold self-center">
                                    +{inq.servicesRequested.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            {inq.proposals && inq.proposals.length > 0 && (
                              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                                <IconDocument className="w-3 h-3" />
                                <span>Proposal v{inq.proposals[0]?.version} ({inq.proposals[0]?.status})</span>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 align-top">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="px-5 py-4 align-top">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${pri.bg} ${pri.text} ${pri.border}`}>
                              {pri.label}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 align-top text-xs text-slate-500 whitespace-nowrap">
                            <div className="font-semibold text-slate-700">
                              {new Date(inq.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(inq.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/sales/inquiries/${inq.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-[#FBF8F3] hover:bg-[#F5EFE6] border border-[#EAE2D5] hover:border-[#B8935B] transition-colors"
                              >
                                <span>Review Lead</span>
                                <IconChevronRight className="w-3.5 h-3.5 text-[#B8935B]" />
                              </Link>

                              <button
                                type="button"
                                onClick={() => deleteInquiry(inq.id, inq.name)}
                                disabled={deleting === inq.id}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors disabled:opacity-40"
                                title="Delete lead"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Stacked Card View (smaller than md) */}
            <div className="block md:hidden space-y-3">
              {inquiries.map((inq) => {
                const st = STATUS_CONFIG[inq.status] || STATUS_CONFIG.NEW;
                const pri = PRIORITY_BADGES[inq.priority] || PRIORITY_BADGES.MEDIUM;

                return (
                  <div
                    key={inq.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mb-1">
                          {inq.displayId}
                        </div>
                        <h3 className="font-bold text-base text-slate-900">{inq.name}</h3>
                        <p className="text-xs text-slate-500">{inq.email}</p>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Requirement</span>
                        <span className="font-semibold text-slate-800">{inq.requirementType?.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Priority</span>
                        <span className={`inline-block px-2 py-0.2 rounded text-[10px] font-bold border ${pri.bg} ${pri.text} ${pri.border}`}>
                          {pri.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Link
                        href={`/sales/inquiries/${inq.id}`}
                        className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span>Review Inquiry</span>
                        <IconChevronRight className="w-3.5 h-3.5 text-[#B8935B]" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteInquiry(inq.id, inq.name)}
                        disabled={deleting === inq.id}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors disabled:opacity-40"
                        title="Delete Inquiry"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-500 font-medium">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total leads)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fetchInquiries(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                    const active = p === pagination.page;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => fetchInquiries(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          active
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => fetchInquiries(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
