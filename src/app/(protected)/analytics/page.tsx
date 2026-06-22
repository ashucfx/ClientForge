'use client';

import { useEffect, useState, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { useBrand } from '@/components/BrandProvider';
import { IconTrendUp, IconTrendDown, IconDocument, IconCheck, IconPending, IconUser, IconAlert, IconMail, IconFolder } from '@/components/Icons';
import { formatCurrency } from '@/lib/pricing';

interface MonthlyRevenue { month: string; revenue: number; invoiceRevenue?: number; externalRevenue?: number; count: number; }
interface BrandRevenue { brand: string; revenue: number; count?: number; }
interface ChannelRevenue { channel: string; revenue: number; count?: number; }
interface TierRevenue { tier: string; revenue: number; count?: number; }

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
  const [chartData, setChartData] = useState<{ monthly: MonthlyRevenue[]; byBrand: BrandRevenue[]; byChannel: ChannelRevenue[]; byTier: TierRevenue[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      const results = await Promise.allSettled([
        fetch('/api/admin/analytics/executive').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics/operations').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics/sla').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics/satisfaction').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics/lifecycle').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics/revenue-chart').then(r => r.ok ? r.json() : null),
      ]);
      const [exec, ops, sla, sat, life, chart] = results;
      if (exec.status === 'fulfilled' && exec.value) setExecData(exec.value);
      if (ops.status === 'fulfilled' && ops.value) setOpsData(ops.value);
      if (sla.status === 'fulfilled' && sla.value) setSlaData(sla.value);
      if (sat.status === 'fulfilled' && sat.value) setSatData(sat.value);
      if (life.status === 'fulfilled' && life.value) setLifeData(life.value);
      if (chart.status === 'fulfilled' && chart.value) setChartData(chart.value);
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Analytics</h1>
          <p className="text-slate-500 mt-1">A snapshot of revenue, active clients, delivery performance, and team health — refreshes on every page load.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin text-blue-600"><IconPending size={32} /></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* SECTION 1 - EXECUTIVE COMMAND CENTER */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`card hover-lift transition-all duration-200 p-5 ring-1 ring-blue-200 shadow-sm`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                    <IconTrendUp className="text-blue-600" />
                  </div>
                  {execData?.revenue?.rateSource && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${execData.revenue.rateSource === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {execData.revenue.rateSource === 'live' ? 'live rates' : 'approx rates'}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1">Total Revenue — All Time</div>
                  <div className="text-3xl font-bold tracking-tight mb-1 text-blue-600">
                    ₹{execData?.revenue?.value != null ? Number(execData.revenue.value).toLocaleString('en-IN') : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">≈ INR equivalent · portal + manual clients</div>
                  {execData?.revenue?.currencyBreakdown?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {execData.revenue.currencyBreakdown.slice(0, 4).map((b: any) => (
                        <span key={b.currency} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                          {b.currency} {Number(b.amount).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}
                  {execData?.revenue?.externalRevenue > 0 && (
                    <div className="text-xs text-slate-500 mb-1">
                      + ₹{Number(execData.revenue.externalRevenue).toLocaleString('en-IN')} from manual onboarding
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {execData?.revenue?.trendPct !== undefined && (
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${(execData.revenue.trendPct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(execData.revenue.trendPct ?? 0) >= 0 ? <IconTrendUp size={14} /> : <IconTrendDown size={14} />}
                        {Math.abs(execData.revenue.trendPct ?? 0)}%
                      </span>
                    )}
                    <span className="text-xs text-slate-400">vs last 30d</span>
                  </div>
                </div>
              </div>
              <KpiCard
                label="Active Clients"
                value={execData?.activeClients?.value || 0}
                trendPct={execData?.activeClients?.trendPct}
                trendDirection={execData?.activeClients?.trendDirection}
                context="Clients currently in progress"
                icon={<IconUser className="text-emerald-600" />}
                bg="#d1fae5"
              />
              <KpiCard
                label="NPS — Client Satisfaction"
                value={execData?.satisfaction?.value !== null ? execData?.satisfaction?.value : 'Insufficient Data'}
                trendPct={execData?.satisfaction?.trendPct}
                trendDirection={execData?.satisfaction?.trendDirection}
                context="Net Promoter Score: −100 to +100. Above 50 = excellent"
                icon={<span className="text-violet-600 font-bold text-lg">NPS</span>}
                bg="#ede9fe"
              />
              <KpiCard
                label="Sales Pipeline Value"
                value={execData?.pipeline?.value?.toLocaleString()}
                trendPct={execData?.pipeline?.trendPct}
                trendDirection={execData?.pipeline?.trendDirection}
                context="Estimated revenue from leads currently in pipeline"
                icon={<IconTrendUp className="text-amber-600" />}
                bg="#fef3c7"
              />
            </div>

            {/* SECTION 2 - OPERATIONAL ALERTS */}
            <div className="card border-l-4 border-l-rose-500 shadow-sm p-0 overflow-hidden">
              <div className="bg-rose-50 px-5 py-4 border-b border-rose-100 flex items-center gap-3">
                <IconAlert className="text-rose-600" />
                <div>
                  <h2 className="text-rose-900 font-semibold">Action Required</h2>
                  <p className="text-xs text-rose-600 mt-0.5">Items that need your immediate attention right now</p>
                </div>
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
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl mt-0.5">⚠</span>
                        <div>
                          <p className="font-semibold">{opsData.alerts.nearSlaBreach} project{opsData.alerts.nearSlaBreach > 1 ? 's' : ''} approaching delivery deadline</p>
                          <p className="text-xs text-rose-600 mt-0.5">SLA deadline within the next 3 working days — review and prioritise these clients</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.unreadMessages24h > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-orange-50 px-4 py-3 rounded-lg border border-orange-100">
                        <span className="text-orange-600 font-bold text-xl mt-0.5">⚠</span>
                        <div>
                          <p className="font-semibold">{opsData.alerts.unreadMessages24h} client{opsData.alerts.unreadMessages24h > 1 ? 's' : ''} waiting more than 24 hours for a reply</p>
                          <p className="text-xs text-orange-600 mt-0.5">Unanswered messages hurt satisfaction scores — respond before the 48-hour mark</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.negativeFeedback > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl mt-0.5">⚠</span>
                        <div>
                          <p className="font-semibold">{opsData.alerts.negativeFeedback} low-rating feedback submission{opsData.alerts.negativeFeedback > 1 ? 's' : ''} received</p>
                          <p className="text-xs text-rose-600 mt-0.5">Clients rated their experience 2/5 or below — follow up personally</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.atRiskClients > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-bold text-xl mt-0.5">⚠</span>
                        <div>
                          <p className="font-semibold">{opsData.alerts.atRiskClients} client{opsData.alerts.atRiskClients > 1 ? 's' : ''} flagged as at-risk</p>
                          <p className="text-xs text-rose-600 mt-0.5">Health score below 50 — signs of disengagement, overdue revision, or poor communication</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* SECTION 3 - DELIVERY PERFORMANCE */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Delivery Performance</h3>
                  <IconDocument className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 mb-6">How reliably you deliver work within the committed timeframe. SLA = Service Level Agreement — the deadline promised to each client (weekends &amp; public holidays excluded).</p>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <div>
                        <span className="text-slate-700 font-semibold">On-Time Delivery Rate</span>
                        <p className="text-xs text-slate-400 mt-0.5">% of completed projects delivered by their SLA deadline</p>
                      </div>
                      <span className="font-bold text-slate-900 text-xl">{slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full ${(slaData?.current?.slaMetPercentage ?? 100) >= 90 ? 'bg-emerald-500' : (slaData?.current?.slaMetPercentage ?? 100) >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Last 30 days · 90%+ is target</span>
                      {slaData?.trends?.slaMetTrend !== undefined && (
                        <TrendIndicator trendPct={slaData.trends.slaMetTrend} trendDirection={slaData.trends.slaMetTrend >= 0 ? 'up' : 'down'} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500 font-semibold mb-1">Avg Time to Deliver</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {slaData?.current?.averageDeliveryTimeDays ?? slaData?.lifetime?.averageDeliveryTimeDays ?? 0}
                        <span className="text-sm font-normal text-slate-500 ml-1">days</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Calendar days from onboarding to completion</p>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-semibold mb-1">Avg Revisions per Client</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {slaData?.revisionRate ?? 0}
                        <span className="text-sm font-normal text-slate-500 ml-1">rounds</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Lower = clearer brief &amp; stronger first drafts</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4 - CLIENT HEALTH CENTER */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Client Health Overview</h3>
                  <IconUser className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 mb-6">Each active client gets an automated health score (0–100) based on satisfaction rating, response speed, and revision risk. Healthy ≥ 70 · Attention 50–69 · At Risk &lt; 50.</p>
                
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
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Client Satisfaction</h3>
                  <span className="text-xl">⭐</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">Collected from the post-project feedback form. NPS measures how likely clients are to recommend you (−100 to +100). Avg Rating is the overall service score (1–5).</p>
                
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
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Response &amp; Communication</h3>
                  <IconMail className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 mb-6">Tracks how quickly you respond to client messages. Target: reply within 24 hours. Clients waiting over 48 hours are at high churn risk.</p>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-blue-50 text-blue-900 p-4 rounded-lg">
                    <div>
                      <div className="font-bold text-2xl">{opsData?.communications?.communicationSlaCompliance}%</div>
                      <div className="text-sm text-blue-700">Replied within 24 hrs (compliance)</div>
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
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Revenue Breakdown</h3>
                  <IconTrendUp className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 mb-6">All amounts are in ₹ INR equivalent (foreign currency invoices are converted at approximate rates). &ldquo;Repeat Revenue&rdquo; is revenue from clients who purchased more than once.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-700 uppercase tracking-wider mb-1">All-Time Revenue</div>
                    <div className="text-2xl font-bold text-blue-900">{formatCurrency(execData?.revenue?.lifetimeValue || 0, '₹')}</div>
                    {execData?.revenue?.externalRevenue > 0 && (
                      <div className="text-xs text-blue-600 mt-1">incl. ₹{Number(execData.revenue.externalRevenue).toLocaleString('en-IN')} external</div>
                    )}
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
                  {/* Brand + Channel + Tier breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                    {chartData?.byBrand && chartData.byBrand.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">By Brand</div>
                        {chartData.byBrand.map(b => (
                          <div key={b.brand} className="flex justify-between items-center py-1">
                            <span className="text-xs text-slate-600 capitalize">{b.brand || 'Direct'}</span>
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(b.revenue, '₹')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {chartData?.byChannel && chartData.byChannel.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">By Channel</div>
                        {chartData.byChannel.map(c => (
                          <div key={c.channel} className="flex justify-between items-center py-1">
                            <span className="text-xs text-slate-600">{c.channel}</span>
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(c.revenue, '₹')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {chartData?.byTier && chartData.byTier.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">By Client Tier</div>
                        {chartData.byTier.map(t => (
                          <div key={t.tier} className="flex justify-between items-center py-1">
                            <span className="text-xs text-slate-600">{t.tier?.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(t.revenue, '₹')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 7 - LIFECYCLE INTELLIGENCE (Only renders if archived clients > 0) */}
              {lifeData?.totalArchived > 0 ? (
                <div className="card p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-slate-900">Client Lifecycle &amp; Retention</h3>
                    <IconFolder className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-400 mb-6">Tracks completed (archived) clients. &ldquo;Reactivated&rdquo; means a past client came back for another service. Repeat Revenue = total collected from returning clients.</p>
                  
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
