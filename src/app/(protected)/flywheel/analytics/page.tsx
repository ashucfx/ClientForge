'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { getBrand } from '@/lib/brand/registry';
import {
  IconTrendUp, IconMail, IconUser, IconLink, IconTarget,
  IconRefresh, IconInbox
} from '@/components/Icons';

const STAGES = ['SUBSCRIBER', 'LEAD', 'MQL', 'SQL', 'CUSTOMER'];
const STAGE_LABELS: Record<string, string> = {
  SUBSCRIBER: 'Subscribers', LEAD: 'Leads', MQL: 'MQL', SQL: 'SQL', CUSTOMER: 'Customers'
};

export default function FlywheelAnalytics() {
  const { activeBrand } = useBrand();
  const brand = getBrand(activeBrand === 'all' ? 'catalyst' : activeBrand);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/flywheel/analytics/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  const totalFunnelCount = data ? STAGES.reduce((sum, st) => sum + (data.funnel[st] || 0), 0) : 0;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <IconTrendUp size={20} style={{ color: '#fff' }} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Growth Analytics</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-[52px]">Deep dive into your funnel conversion and campaign performance.</p>
          </div>
          <button onClick={fetchAnalytics} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium text-sm shadow-sm hover:bg-slate-50 transition-colors">
            <IconRefresh size={15} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="animate-spin text-amber-600"><IconRefresh size={32} /></div>
          </div>
        ) : data ? (
          <div className="space-y-8">

            {/* Email Performance Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-2">
                  <IconSend size={16} /> Total Sent
                </div>
                <div className="text-3xl font-bold text-slate-900">{data.emailPerformance.totalSent.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-2">
                  <IconEye size={16} /> Total Opens
                </div>
                <div className="text-3xl font-bold text-violet-600">{data.emailPerformance.totalOpens.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-2">
                  <IconLink size={16} /> Total Clicks
                </div>
                <div className="text-3xl font-bold text-blue-600">{data.emailPerformance.totalClicks.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-2">
                  <IconTarget size={16} /> Avg Open Rate
                </div>
                <div className="text-3xl font-bold text-emerald-600">{data.emailPerformance.openRate}%</div>
              </div>
            </div>

            {/* Funnel & Conversion Rates */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Conversion Funnel</h3>
              {totalFunnelCount === 0 ? (
                <div className="py-12 text-center text-slate-400">No funnel data available yet.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {STAGES.map((stage, idx) => {
                    const count = data.funnel[stage] || 0;
                    const pct = (count / totalFunnelCount) * 100;
                    const conv = data.conversions.find((c: any) => c.from === stage);

                    return (
                      <div key={stage}>
                        <div className="flex items-center gap-4">
                          <div className="w-32 font-semibold text-slate-700">{STAGE_LABELS[stage]}</div>
                          <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden relative">
                            <div className="h-full rounded-full flex items-center px-3" style={{ width: `${Math.max(pct, 5)}%`, background: brand.gradient, opacity: 1 - (idx * 0.15) }}>
                              {pct > 10 && <span className="text-white text-xs font-bold">{count}</span>}
                            </div>
                            {pct <= 10 && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-bold">{count}</span>}
                          </div>
                          <div className="w-16 text-right font-bold text-slate-600">{pct.toFixed(1)}%</div>
                        </div>

                        {conv && (
                          <div className="flex items-center gap-4 my-2 ml-[144px]">
                            <div className="w-px h-6 border-l-2 border-dashed border-slate-300 ml-4" />
                            <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                              {conv.rate}% conversion to {STAGE_LABELS[conv.to]}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Campaign ROI / Performance */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Top Campaigns by Open Rate</h3>
                <div className="space-y-4">
                  {data.campaignPerformance.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">No campaigns sent yet.</div>
                  ) : (
                    data.campaignPerformance
                      .filter((c: any) => c.sent > 0)
                      .sort((a: any, b: any) => b.openRate - a.openRate)
                      .slice(0, 5)
                      .map((c: any) => (
                        <div key={c.id} className="p-4 bg-slate-50 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-semibold text-slate-800">{c.name}</div>
                            <div className="font-bold text-emerald-600">{c.openRate}% Open Rate</div>
                          </div>
                          <div className="flex gap-4 text-sm text-slate-500">
                            <span>{c.sent} Sent</span>
                            <span>{c.opens} Opens</span>
                            <span>{c.clicks} Clicks</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Lead Sources */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Lead Source Distribution</h3>
                <div className="space-y-4">
                  {Object.keys(data.leadSources).length === 0 ? (
                    <div className="py-8 text-center text-slate-400">No source data available.</div>
                  ) : (
                    Object.entries(data.leadSources)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([source, count]: [string, any]) => {
                        const pct = (count / totalFunnelCount) * 100;
                        return (
                          <div key={source} className="flex items-center gap-3">
                            <div className="w-32 text-sm font-medium text-slate-600 truncate">{source.replace(/_/g, ' ')}</div>
                            <div className="flex-1 bg-slate-100 rounded-full h-3">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: brand.primaryColor }} />
                            </div>
                            <div className="w-12 text-right text-sm font-bold text-slate-700">{count}</div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Top Contacts */}
              <div className="card p-6 lg:col-span-2">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Most Engaged Contacts</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4 rounded-tl-lg">Contact</th>
                        <th className="py-3 px-4">Company</th>
                        <th className="py-3 px-4">Stage</th>
                        <th className="py-3 px-4 text-center">Engagement Score</th>
                        <th className="py-3 px-4 text-right rounded-tr-lg">LTV Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topContacts.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">No engagement data yet.</td></tr>
                      ) : (
                        data.topContacts.map((c: any) => (
                          <tr key={c.id}>
                            <td className="py-3 px-4 font-semibold text-slate-800">{c.name}</td>
                            <td className="py-3 px-4 text-slate-500">{c.company || '—'}</td>
                            <td className="py-3 px-4 text-slate-500">{c.lifecycleStage}</td>
                            <td className="py-3 px-4 text-center font-bold text-amber-500">⚡ {c.engagementScore}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">₹{c.totalRevenue.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-32 text-slate-400">Failed to load analytics data.</div>
        )}
      </div>
    </AppShell>
  );
}

// Ensure icons used exist in Icons.tsx, if missing we will use fallbacks, but I added most of them
function IconSend({ size = 18, style, className }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={style} className={className}>
      <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconEye({ size = 18, style, className }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={style} className={className}>
      <path d="M1 12S4 4 12 4S23 12 23 12S20 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
