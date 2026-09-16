'use client';
// src/app/(protected)/referrals/page.tsx
// Admin view: all referral relationships — who referred whom, conversion, revenue.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { IconSearch, IconUser, IconTrendUp, IconCheck } from '@/components/Icons';

interface ReferralEntry {
  contactId: string;
  name: string;
  email: string;
  joinedAt: string;
  isConverted: boolean;
  revenue: number;
}

interface ReferrerRow {
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referralCode: string | null;
  totalReferrals: number;
  convertedCount: number;
  totalRevenue: number;
  referrals: ReferralEntry[];
}

export default function ReferralsPage() {
  const [rows, setRows] = useState<ReferrerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const res = await fetch(`/api/admin/referrals${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    if (res.ok) {
      const data = await res.json() as { referrers: ReferrerRow[] };
      setRows(data.referrers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load(search);
  };

  const totalReferrals = rows.reduce((s, r) => s + r.totalReferrals, 0);
  const totalConverted = rows.reduce((s, r) => s + r.convertedCount, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#B8935B]" />
              <span>Deliverables & Growth</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center shadow-xs">
                <IconUser size={18} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Client Referrals</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track client advocacy, referral link performance, conversions, and associated revenue.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search referrer name or email…"
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 focus:border-[#B8935B] transition-all shadow-xs"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                <IconSearch size={14} />
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); void load(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#B8935B] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#9A7540] transition-colors shadow-xs shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Referrals</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{totalReferrals}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
              <IconUser size={18} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Converted Clients</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{totalConverted}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
              <IconCheck size={18} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#B8935B] uppercase tracking-wider">Attributed Revenue</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">₹{totalRevenue.toLocaleString('en-IN')}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] flex items-center justify-center text-[#B8935B]">
              <IconTrendUp size={18} />
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse shadow-xs" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <IconUser size={22} />
            </div>
            <p className="text-base font-bold text-slate-900">No referrers found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Clients will appear here once they generate referral links and invite contacts who sign up.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => {
              const isExpanded = expanded === row.referrerId;
              return (
                <div key={row.referrerId} className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden transition-all">
                  {/* Row header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : row.referrerId)}
                    className="w-full p-4 sm:p-5 hover:bg-slate-50/70 transition-colors text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#B8935B] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                        {row.referrerName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/career/${row.referrerId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-sm font-bold text-slate-900 hover:text-[#B8935B] transition-colors truncate block"
                        >
                          {row.referrerName}
                        </Link>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{row.referrerEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {row.referralCode && (
                        <span className="font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-600 font-semibold">
                          {row.referralCode}
                        </span>
                      )}
                      <div className="text-left sm:text-center">
                        <p className="text-sm sm:text-base font-extrabold text-slate-900">{row.totalReferrals}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Referred</p>
                      </div>
                      <div className="text-left sm:text-center">
                        <p className="text-sm sm:text-base font-extrabold text-emerald-600">{row.convertedCount}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Converted</p>
                      </div>
                      <div className="text-left sm:text-center">
                        <p className="text-sm sm:text-base font-extrabold text-[#B8935B]">₹{row.totalRevenue.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Revenue</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </button>

                  {/* Expanded referrals list */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 sm:px-6 py-4 bg-slate-50/60 space-y-3">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Referred Contacts</p>
                      {row.referrals.length === 0 ? (
                        <p className="text-xs text-slate-400">No referrals recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {row.referrals.map(ref => (
                            <div key={ref.contactId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-xl p-3 sm:px-4 sm:py-2.5 border border-slate-200/60 shadow-xs gap-2 sm:gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {ref.name[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{ref.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{ref.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  ref.isConverted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {ref.isConverted ? 'Client' : 'Lead'}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                  {new Date(ref.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

