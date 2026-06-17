'use client';
// src/app/(protected)/referrals/page.tsx
// Admin view: all referral relationships — who referred whom, conversion, revenue.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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

  const totalReferrals   = rows.reduce((s, r) => s + r.totalReferrals, 0);
  const totalConverted   = rows.reduce((s, r) => s + r.convertedCount, 0);
  const totalRevenue     = rows.reduce((s, r) => s + r.totalRevenue, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Referral Clients</h1>
        <p className="text-sm text-slate-500 mt-1">Clients who have referred others through their unique referral link</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Referrals" value={totalReferrals} />
        <StatCard label="Converted to Clients" value={totalConverted} highlight />
        <StatCard label="Revenue from Referrals" value={`₹${totalRevenue.toLocaleString('en-IN')}`} />
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by referrer name or email…"
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-white"
        />
        <button type="submit"
          className="px-4 py-2.5 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] transition-colors">
          Search
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-base font-medium">No referrers found</p>
          <p className="text-sm mt-1">Clients will appear here once they refer someone who signs up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.referrerId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Row header */}
              <button
                onClick={() => setExpanded(expanded === row.referrerId ? null : row.referrerId)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#B8935B] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {row.referrerName[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/career/${row.referrerId}`}
                      onClick={e => e.stopPropagation()}
                      className="text-sm font-semibold text-slate-900 hover:text-[#B8935B] transition-colors"
                    >
                      {row.referrerName}
                    </Link>
                    <p className="text-xs text-slate-400 truncate">{row.referrerEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                  {row.referralCode && (
                    <span className="hidden sm:block font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                      {row.referralCode}
                    </span>
                  )}
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900">{row.totalReferrals}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Referred</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-600">{row.convertedCount}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Converted</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-base font-bold text-[#B8935B]">₹{row.totalRevenue.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400 uppercase">Revenue</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${expanded === row.referrerId ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </div>
              </button>

              {/* Expanded referrals list */}
              {expanded === row.referrerId && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Referred Contacts</p>
                  {row.referrals.length === 0 ? (
                    <p className="text-sm text-slate-400">No referrals recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {row.referrals.map(ref => (
                        <div key={ref.contactId} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-slate-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {ref.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{ref.name}</p>
                              <p className="text-xs text-slate-400 truncate">{ref.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              ref.isConverted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {ref.isConverted ? 'Client' : 'Lead'}
                            </span>
                            <span className="text-xs text-slate-400">
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
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
