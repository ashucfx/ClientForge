'use client';

import { useEffect, useState, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { IconTrendUp, IconTrendDown, IconDocument, IconCheck, IconPending, IconUser, IconAlert, IconMail, IconFolder } from '@/components/Icons';
import { formatCurrency } from '@/lib/pricing';

interface MonthlyRevenue { month: string; revenue: number; count: number; }
interface BrandRevenue { brand: string; revenue: number; }

function RevenueBarChart({ data }: { data: MonthlyRevenue[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  if (!data.length) return (
    <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">No paid invoices yet.</div>
  );
  const max = Math.max(...data.map(d => d.revenue), 1);
  const W = 560; const H = 180; const PAD_L = 60; const PAD_B = 32; const PAD_T = 10; const BAR_GAP = 6;
  const barW = (W - PAD_L - (data.length + 1) * BAR_GAP) / data.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: max * f, y: PAD_T + (H - PAD_B - PAD_T) * (1 - f) }));

  const fmtK = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` : `₹${n}`;
  const fmtMonth = (m: string) => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' }); };

  return (
    <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, height: H }} aria-label="Monthly revenue chart">
        {/* Y axis grid + labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray={v === 0 ? '' : '4,4'} />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtK(v)}</text>
          </g>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const bh = Math.max(2, ((H - PAD_B - PAD_T) * d.revenue) / max);
          const bx = PAD_L + BAR_GAP + i * (barW + BAR_GAP);
          const by = H - PAD_B - bh;
          return (
            <g key={d.month}>
              <rect x={bx} y={by} width={barW} height={bh} rx={3} fill="#3b82f6" opacity={0.85} />
              <text x={bx + barW / 2} y={H - PAD_B + 12} textAnchor="middle" fontSize={8} fill="#64748b">{fmtMonth(d.month)}</text>
              {bh > 20 && (
                <text x={bx + barW / 2} y={by - 3} textAnchor="middle" fontSize={8} fill="#1e40af">{fmtK(d.revenue)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { activeBrand } = useBrand();
  const [execData, setExecData] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [slaData, setSlaData] = useState<any>(null);
  const [satData, setSatData] = useState<any>(null);
  const [lifeData, setLifeData] = useState<any>(null);
  const [chartData, setChartData] = useState<{ monthly: MonthlyRevenue[]; byBrand: BrandRevenue[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const [execRes, opsRes, slaRes, satRes, lifeRes, chartRes] = await Promise.all([
          fetch('/api/admin/analytics/executive'),
          fetch('/api/admin/analytics/operations'),
          fetch('/api/admin/analytics/sla'),
          fetch('/api/admin/analytics/satisfaction'),
          fetch('/api/admin/analytics/lifecycle'),
          fetch('/api/admin/analytics/revenue-chart'),
        ]);
        if (execRes.ok) setExecData(await execRes.json());
        if (opsRes.ok) setOpsData(await opsRes.json());
        if (slaRes.ok) setSlaData(await slaRes.json());
        if (satRes.ok) setSatData(await satRes.json());
        if (lifeRes.ok) setLifeData(await lifeRes.json());
        if (chartRes.ok) setChartData(await chartRes.json());
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      }
      setLoading(false);
    }
    fetchAnalytics();
  }, []);

  const TrendIndicator = ({ trendPct, trendDirection }: { trendPct: number, trendDirection: 'up' | 'down' | 'neutral' }) => {
    if (trendPct === 0 || trendPct === null || isNaN(trendPct)) return <span className="text-sm font-medium text-slate-400">No change</span>;
    const isPositive = trendDirection === 'up';
    const color = isPositive ? 'text-emerald-600' : 'text-rose-600';
    const Icon = isPositive ? IconTrendUp : IconTrendDown;
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
        <Icon size={14} />
        {Math.abs(trendPct)}%
      </span>
    );
  };

  const KpiCard = ({ label, value, trendPct, trendDirection, context, icon, bg, accent = false }: any) => (
    <div className={`card hover-lift transition-all duration-200 p-5 ${accent ? 'ring-1 ring-blue-200 shadow-sm' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
        <div className={`text-3xl font-bold tracking-tight mb-2 ${accent ? 'text-blue-600' : 'text-slate-900'}`}>
          {value !== null && value !== undefined ? value : 'N/A'}
        </div>
        <div className="flex items-center gap-2">
          {trendPct !== undefined && <TrendIndicator trendPct={trendPct} trendDirection={trendDirection} />}
          {context && <span className="text-xs text-slate-400 truncate">{context}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Command Center</h1>
          <p className="text-slate-500 mt-1">Real-time business intelligence and operational alerts</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin text-blue-600"><IconPending size={32} /></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* SECTION 1 - EXECUTIVE COMMAND CENTER */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard 
                label="Total Revenue (Global LTV)" 
                value={execData?.revenue?.value?.toLocaleString()} 
                trendPct={execData?.revenue?.trendPct}
                trendDirection={execData?.revenue?.trendDirection}
                context={execData?.revenue?.context}
                icon={<IconTrendUp className="text-blue-600" />} 
                bg="#eff6ff" 
                accent 
              />
              <KpiCard 
                label="Active Clients" 
                value={execData?.activeClients?.value || 0} 
                trendPct={execData?.activeClients?.trendPct}
                trendDirection={execData?.activeClients?.trendDirection}
                context={execData?.activeClients?.context}
                icon={<IconUser className="text-emerald-600" />} 
                bg="#d1fae5" 
              />
              <KpiCard 
                label="Net Promoter Score" 
                value={execData?.satisfaction?.value !== null ? execData?.satisfaction?.value : 'Insufficient Data'} 
                trendPct={execData?.satisfaction?.trendPct}
                trendDirection={execData?.satisfaction?.trendDirection}
                context={execData?.satisfaction?.context}
                icon={<span className="text-violet-600 font-bold text-lg">NPS</span>} 
                bg="#ede9fe" 
              />
              <KpiCard 
                label="Pipeline Value" 
                value={execData?.pipeline?.value?.toLocaleString()} 
                trendPct={execData?.pipeline?.trendPct}
                trendDirection={execData?.pipeline?.trendDirection}
                context={execData?.pipeline?.context}
                icon={<IconTrendUp className="text-amber-600" />} 
                bg="#fef3c7" 
              />
            </div>

            {/* SECTION 2 - OPERATIONAL ALERTS */}
            <div className="card border-l-4 border-l-rose-500 shadow-sm p-0 overflow-hidden">
              <div className="bg-rose-50 px-5 py-4 border-b border-rose-100 flex items-center gap-3">
                <IconAlert className="text-rose-600" />
                <h2 className="text-rose-900 font-semibold">Action Required</h2>
              </div>
              <div className="p-5">
                {(!opsData?.alerts?.nearSlaBreach && !opsData?.alerts?.unreadMessages24h && !opsData?.alerts?.negativeFeedback && !opsData?.alerts?.atRiskClients) ? (
                  <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg">
                    <IconCheck size={20} />
                    <span className="font-medium">All operations are running smoothly. No critical alerts.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {opsData?.alerts?.nearSlaBreach > 0 && (
                      <div className="flex items-center gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl">⚠</span>
                        <span className="font-medium">{opsData.alerts.nearSlaBreach} Projects Near SLA Breach</span>
                      </div>
                    )}
                    {opsData?.alerts?.unreadMessages24h > 0 && (
                      <div className="flex items-center gap-3 text-slate-700 bg-orange-50 px-4 py-3 rounded-lg border border-orange-100">
                        <span className="text-orange-600 font-bold text-xl">⚠</span>
                        <span className="font-medium">{opsData.alerts.unreadMessages24h} Clients waiting &gt; 24 hours for a response</span>
                      </div>
                    )}
                    {opsData?.alerts?.negativeFeedback > 0 && (
                      <div className="flex items-center gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl">⚠</span>
                        <span className="font-medium">{opsData.alerts.negativeFeedback} Negative Feedbacks require review</span>
                      </div>
                    )}
                    {opsData?.alerts?.atRiskClients > 0 && (
                      <div className="flex items-center gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl">⚠</span>
                        <span className="font-medium">{opsData.alerts.atRiskClients} Clients At Risk (Health &lt; 50)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* SECTION 3 - DELIVERY PERFORMANCE */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Delivery Performance</h3>
                  <IconDocument className="text-slate-400" />
                </div>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-500 font-medium">SLA Compliance %</span>
                      <span className="font-bold text-slate-900">{slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%` }}></div>
                    </div>
                    {slaData?.trends?.slaMetTrend !== undefined && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Current Period</span>
                        <TrendIndicator trendPct={slaData.trends.slaMetTrend} trendDirection={slaData.trends.slaMetTrend >= 0 ? 'up' : 'down'} />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Delivery Time</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {slaData?.current?.averageDeliveryTimeDays ?? slaData?.lifetime?.averageDeliveryTimeDays ?? 0} <span className="text-sm font-normal text-slate-500">days</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Revision Count</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {slaData?.revisionRate ?? 0} <span className="text-sm font-normal text-slate-500">per client</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4 - CLIENT HEALTH CENTER */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Client Health Center</h3>
                  <IconUser className="text-slate-400" />
                </div>
                
                {opsData?.health?.totalTracked === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">Health analytics will appear once clients begin onboarding.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-end gap-3">
                      <div className="text-4xl font-bold text-slate-900">{opsData?.health?.averageScore || 0}</div>
                      <div className="text-sm text-slate-500 mb-1">/ 100 Avg Health Score</div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm text-emerald-600 font-medium">Healthy</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(opsData?.health?.healthy / opsData?.health?.totalTracked) * 100}%` }}></div>
                        </div>
                        <div className="w-8 text-right text-sm font-medium text-slate-700">{opsData?.health?.healthy}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm text-amber-600 font-medium">Attention</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(opsData?.health?.attentionNeeded / opsData?.health?.totalTracked) * 100}%` }}></div>
                        </div>
                        <div className="w-8 text-right text-sm font-medium text-slate-700">{opsData?.health?.attentionNeeded}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm text-rose-600 font-medium">At Risk</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${(opsData?.health?.atRisk / opsData?.health?.totalTracked) * 100}%` }}></div>
                        </div>
                        <div className="w-8 text-right text-sm font-medium text-slate-700">{opsData?.health?.atRisk}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5 - CUSTOMER SATISFACTION CENTER */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Satisfaction Intelligence</h3>
                  <span className="text-xl">⭐</span>
                </div>
                
                {satData?.lifetime?.totalResponses === 0 && satData?.lifetime?.reviewsCount === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">Feedback analytics will appear once clients submit reviews.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">NPS (Current)</div>
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold text-slate-900">{satData?.current?.nps !== null ? satData?.current?.nps : 'N/A'}</div>
                          {satData?.trends?.npsTrend !== undefined && <TrendIndicator trendPct={satData.trends.npsTrend} trendDirection={satData.trends.npsTrend >= 0 ? 'up' : 'down'} />}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Rating</div>
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold text-slate-900">{satData?.current?.avgRating !== null ? satData?.current?.avgRating : 'N/A'}</div>
                          {satData?.trends?.avgRatingTrend !== undefined && <TrendIndicator trendPct={satData.trends.avgRatingTrend} trendDirection={satData.trends.avgRatingTrend >= 0 ? 'up' : 'down'} />}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Total Feedback Collected</span>
                        <span className="font-bold text-slate-900">{satData?.lifetime?.totalResponses || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Public Testimonials</span>
                        <span className="font-bold text-slate-900">{satData?.lifetime?.testimonialsCollected || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">{satData?.services?.singleServiceRated ? 'Most Rated Service' : 'Most Loved Service'}</span>
                        <span className="font-bold text-emerald-600">{satData?.services?.mostLovedService}</span>
                      </div>
                      {!satData?.services?.singleServiceRated && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Lowest Rated Service</span>
                          <span className="font-bold text-rose-600">{satData?.services?.lowestRatedService}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 8 - COMMUNICATION INTELLIGENCE */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Communication Intelligence</h3>
                  <IconMail className="text-slate-400" />
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-blue-50 text-blue-900 p-4 rounded-lg">
                    <div>
                      <div className="font-bold text-2xl">{opsData?.communications?.communicationSlaCompliance}%</div>
                      <div className="text-sm text-blue-700">Communication SLA Compliance</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">{opsData?.communications?.totalUnreadMessages}</div>
                      <div className="text-sm text-blue-700">Unread Messages</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${opsData?.communications?.clientsWaiting24h > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                        <span className="text-sm font-medium text-slate-700">Clients waiting &gt; 24 hours</span>
                      </div>
                      <span className="font-bold text-slate-900">{opsData?.communications?.clientsWaiting24h || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${opsData?.communications?.clientsWaiting48h > 0 ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                        <span className="text-sm font-medium text-slate-700">Clients waiting &gt; 48 hours</span>
                      </div>
                      <span className="font-bold text-slate-900">{opsData?.communications?.clientsWaiting48h || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 6 - REVENUE INTELLIGENCE */}
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Revenue Intelligence</h3>
                  <IconTrendUp className="text-slate-400" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-700 uppercase tracking-wider mb-1">Total Lifetime Revenue</div>
                    <div className="text-2xl font-bold text-blue-900">{formatCurrency(execData?.revenue?.lifetimeValue || 0, '₹')}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Average LTV</div>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(lifeData?.ltv || 0, '₹')}</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="text-xs text-emerald-700 uppercase tracking-wider mb-1">Repeat Revenue</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-emerald-900">{formatCurrency(lifeData?.repeatRevenue || 0, '₹')}</div>
                      {lifeData?.trends?.reactivationTrend > 0 && <TrendIndicator trendPct={lifeData.trends.reactivationTrend} trendDirection="up" />}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Period</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-slate-900">{formatCurrency(execData?.revenue?.value || 0, '₹')}</div>
                      {execData?.revenue?.trendPct !== undefined && <TrendIndicator trendPct={execData?.revenue?.trendPct} trendDirection={execData?.revenue?.trendDirection} />}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Monthly Revenue (Last 12 Months)</div>
                  <RevenueBarChart data={chartData?.monthly ?? []} />
                  {chartData?.byBrand && chartData.byBrand.length > 0 && (
                    <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                      {chartData.byBrand.map(b => (
                        <div key={b.brand} className="text-center">
                          <div className="text-xs text-slate-500 uppercase tracking-wider">{b.brand}</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(b.revenue, '₹')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 7 - LIFECYCLE INTELLIGENCE (Only renders if archived clients > 0) */}
              {lifeData?.totalArchived > 0 ? (
                <div className="card p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Lifecycle & Retention Intelligence</h3>
                    <IconFolder className="text-slate-400" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Archived Clients</div>
                      <div className="text-2xl font-bold text-slate-900">{lifeData?.totalArchived}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reactivated</div>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-slate-900">{lifeData?.totalReactivated}</div>
                        {lifeData?.trends?.reactivationTrend !== undefined && <TrendIndicator trendPct={lifeData.trends.reactivationTrend} trendDirection={lifeData.trends.reactivationTrend >= 0 ? 'up' : 'down'} />}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reactivation Rate</div>
                      <div className="text-2xl font-bold text-slate-900">{lifeData?.reactivationRate}%</div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                      <div className="text-xs text-emerald-700 uppercase tracking-wider mb-1">Repeat Revenue</div>
                      <div className="text-2xl font-bold text-emerald-700">{formatCurrency(lifeData?.repeatRevenue, '₹')}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card p-6 lg:col-span-2 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200">
                  <div className="text-center">
                    <IconFolder className="mx-auto text-slate-300 mb-2" size={32} />
                    <h3 className="text-sm font-semibold text-slate-700">Lifecycle Intelligence</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Lifecycle and retention analytics will become available after the first archived client.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
