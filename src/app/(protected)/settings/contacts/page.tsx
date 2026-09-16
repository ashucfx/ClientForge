'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useAdmin } from '@/components/AdminProvider';
import { IconTrash, IconCheck, IconCopy, IconSearch, IconUser, IconRefresh } from '@/components/Icons';

export default function ContactsAdminPage() {
  const { isSuperAdmin } = useAdmin();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadContacts = () => {
    setLoading(true);
    fetch('/api/admin/contacts/list')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          d.sort((a, b) => {
            const idA = a.displayId || a.id || '';
            const idB = b.displayId || b.id || '';
            const matchA = idA.match(/(\d+)$/);
            const matchB = idB.match(/(\d+)$/);
            if (matchA && matchB) {
              return parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
            }
            return idB.localeCompare(idA);
          });
          setContacts(d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the contact "${name}"? This will remove all associated orphaned records.`)) return;
    try {
      const res = await fetch(`/api/admin/contacts/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
      } else {
        const err = await res.json();
        alert('Failed to delete: ' + (err.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hasMatchingClient = c.careerClients?.some((cl: any) =>
      (cl.id && cl.id.toLowerCase().includes(q)) ||
      (cl.name && cl.name.toLowerCase().includes(q)) ||
      (cl.email && cl.email.toLowerCase().includes(q))
    );
    return (
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.displayId && c.displayId.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      hasMatchingClient
    );
  });

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage Global Contacts.</p>
        </div>
      </AppShell>
    );
  }

  const totalContacts = contacts.length;
  const activeClientsCount = contacts.filter(c => c.careerClients && c.careerClients.length > 0).length;
  const leadsCount = totalContacts - activeClientsCount;

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Identity & Directory</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center shadow-xs">
                <IconUser size={18} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Global Contacts Directory</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage client records, inspect mapped Customer IDs, and permanently remove orphan lead data.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <input
                type="text"
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] transition-all shadow-xs"
                placeholder="Search by ID, name, email, phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                <IconSearch size={14} />
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={loadContacts}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              title="Refresh directory"
            >
              <IconRefresh size={14} className={loading ? 'animate-spin text-[#B8935B]' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Metrics Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Records</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{totalContacts}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active Customers</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{activeClientsCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#B8935B] uppercase tracking-wider">Unmapped Inquiries</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{leadsCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] flex items-center justify-center text-[#B8935B]">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Content Area ── */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <IconRefresh size={22} className="animate-spin mx-auto text-[#B8935B] mb-2.5" />
            <div className="text-sm font-semibold text-slate-700">Loading contacts directory…</div>
            <p className="text-xs text-slate-400 mt-0.5">Fetching client registry records</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <IconUser size={22} />
            </div>
            <div className="text-sm font-bold text-slate-900">
              {contacts.length === 0 ? 'No contacts found' : 'No matching contacts'}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {contacts.length === 0
                ? 'Your global contact database is currently empty.'
                : `No contacts match your filter criteria "${search}". Try searching by another keyword.`}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile Card Layout (< md) ── */}
            <div className="block md:hidden space-y-3">
              {filteredContacts.map(c => {
                const primaryClient = c.careerClients && c.careerClients.length > 0 ? c.careerClients[0] : null;
                const clientId = primaryClient?.id;
                const leadId = c.displayId || c.id;
                const isClientCopied = clientId && copiedId === clientId;
                const isLeadCopied = copiedId === leadId;

                return (
                  <div key={c.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">{c.name || 'Unnamed Contact'}</div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">{c.email || 'No email provided'}</div>
                        {c.phone && <div className="text-xs text-slate-400 mt-0.5">{c.phone}</div>}
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 border ${
                        c.deletedAt
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : primaryClient
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {c.deletedAt ? 'Deleted' : primaryClient ? 'Active Client' : (c.status || 'Lead')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
                      {primaryClient ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">Customer ID:</span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/career/${primaryClient.id}`}
                              className="font-mono text-xs font-bold text-[#B8935B] hover:underline"
                            >
                              {primaryClient.id.slice(0, 16)}…
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(primaryClient.id, e)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="Copy Customer ID"
                            >
                              {isClientCopied ? <IconCheck size={12} className="text-emerald-600" /> : <IconCopy size={12} />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Customer ID:</span>
                          <span className="italic">Unmapped</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium">Contact Ref:</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(leadId, e)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                        >
                          <span>{leadId}</span>
                          {isLeadCopied ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} className="text-slate-400" />}
                        </button>
                      </div>

                      {c.companyName && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-medium">Company:</span>
                          <span className="font-medium text-slate-800">{c.companyName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      {primaryClient && (
                        <Link
                          href={`/career/${primaryClient.id}`}
                          className="flex-1 py-1.5 rounded-xl bg-[#FBF8F3] hover:bg-[#F4EFE6] border border-[#EAE2D5] text-[#B8935B] text-xs font-bold text-center transition-colors"
                        >
                          Open Workspace →
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors flex items-center justify-center gap-1 shrink-0"
                      >
                        <IconTrash size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop Table Layout (>= md) ── */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[760px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3.5">Mapped Customer</th>
                      <th className="px-4 py-3.5">Contact Ref</th>
                      <th className="px-4 py-3.5">Client Info</th>
                      <th className="px-4 py-3.5">Company</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContacts.map(c => {
                      const primaryClient = c.careerClients && c.careerClients.length > 0 ? c.careerClients[0] : null;
                      const clientId = primaryClient?.id;
                      const leadId = c.displayId || c.id;
                      const isClientCopied = clientId && copiedId === clientId;
                      const isLeadCopied = copiedId === leadId;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* 1. Mapped Customer */}
                          <td className="px-5 py-3.5">
                            {primaryClient ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/career/${primaryClient.id}`}
                                    className="font-mono text-xs font-bold text-[#B8935B] hover:underline"
                                    title="Open Customer Workspace"
                                  >
                                    {primaryClient.id.slice(0, 16)}…
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopy(primaryClient.id, e)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Copy Customer ID"
                                  >
                                    {isClientCopied ? <IconCheck size={12} className="text-emerald-600" /> : <IconCopy size={12} />}
                                  </button>
                                </div>
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active Client
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-xs text-slate-400 italic">No customer record</span>
                                <div>
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    Lead Only
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 2. Contact Ref */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(leadId, e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
                              title="Click to copy Lead Ref"
                            >
                              <span className="font-mono text-xs font-semibold text-slate-700">{leadId}</span>
                              {isLeadCopied ? <IconCheck size={12} className="text-emerald-600" /> : <IconCopy size={12} className="text-slate-400" />}
                            </button>
                          </td>

                          {/* 3. Client Info */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{c.name || 'Unnamed Contact'}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              {c.email && <span>{c.email}</span>}
                              {c.phone && <span className="text-slate-400">· {c.phone}</span>}
                            </div>
                          </td>

                          {/* 4. Company */}
                          <td className="px-4 py-3.5 text-slate-700 text-xs font-medium">
                            {c.companyName || '—'}
                          </td>

                          {/* 5. Status */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              c.deletedAt
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : primaryClient
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {c.deletedAt ? 'Deleted' : primaryClient ? 'Customer' : (c.status || 'Lead')}
                            </span>
                          </td>

                          {/* 6. Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {primaryClient && (
                                <Link
                                  href={`/career/${primaryClient.id}`}
                                  className="px-2.5 py-1 rounded-lg bg-[#FBF8F3] hover:bg-[#F4EFE6] border border-[#EAE2D5] text-[#B8935B] text-xs font-bold transition-colors"
                                  title="Open Workspace"
                                >
                                  View →
                                </Link>
                              )}
                              <button
                                onClick={() => handleDelete(c.id, c.name)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors flex items-center gap-1"
                                title="Delete Contact"
                              >
                                <IconTrash size={12} />
                                <span>Delete</span>
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
          </>
        )}
      </div>
    </AppShell>
  );
}
