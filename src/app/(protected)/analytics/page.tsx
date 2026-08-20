'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data.length) return (
    <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
      No settled invoices recorded yet.
    </div>
  );

  const max = Math.max(...data.map(d => d.revenue), 1);
  const W = 680; const H = 200; const PAD_L = 64; const PAD_B = 34; const PAD_T = 16; const BAR_GAP = 8;
  const barW = Math.max(12, (W - PAD_L - (data.length + 1) * BAR_GAP) / data.length);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: max * f, y: PAD_T + (H - PAD_B - PAD_T) * (1 - f) }));

  const fmtK = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` : `₹${Math.round(n)}`;
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  };

  return (
    <div ref={containerRef} className="w-full overflow-x-auto py-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px] h-[200px] select-none" aria-label="Monthly revenue chart">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B8935B" />
            <stop offset="100%" stopColor="#9A7540" />
          </linearGradient>
          <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF7A" />
            <stop offset="100%" stopColor="#B8935B" />
          </linearGradient>
        </defs>

        {/* Y axis grid lines + labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="#f1f5f9" strokeWidth={1} strokeDasharray={v === 0 ? '' : '3,3'} />
            <text x={PAD_L - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="monospace" fontWeight={500}>{fmtK(v)}</text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const bh = Math.max(3, ((H - PAD_B - PAD_T) * d.revenue) / max);
          const bx = PAD_L + BAR_GAP + i * (barW + BAR_GAP);
          const by = H - PAD_B - bh;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={d.month}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <rect
                x={bx}
                y={by}
                width={barW}
                height={bh}
                rx={4}
                fill={isHovered ? 'url(#barGradHover)' : 'url(#barGrad)'}
                opacity={hoveredIdx !== null && !isHovered ? 0.45 : 1}
                className="transition-all duration-150"
              />
              <text
                x={bx + barW / 2}
                y={H - PAD_B + 15}
                textAnchor="middle"
                fontSize={9.5}
                fill={isHovered ? '#0f172a' : '#64748b'}
                fontWeight={isHovered ? 700 : 500}
              >
                {fmtMonth(d.month)}
              </text>
              {bh > 22 && (
                <text
                  x={bx + barW / 2}
                  y={by - 5}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="#7A5B2E"
                  fontWeight={700}
                  fontFamily="monospace"
                >
                  {fmtK(d.revenue)}
                </text>
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
    if (trendPct === 0 || trendPct === null || isNaN(trendPct)) return <span className="text-xs font-semibold text-slate-400">No change</span>;
    const isPositive = trendDirection === 'up';
    const color = isPositive ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60' : 'text-rose-700 bg-rose-50 border-rose-200/60';
    const Icon = isPositive ? IconTrendUp : IconTrendDown;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border shadow-2xs ${color}`}>
        <Icon size={12} />
        {Math.abs(trendPct)}%
      </span>
    );
  };

  const KpiCard = ({ label, value, trendPct, trendDirection, context, icon, bg, accent = false }: any) => (
    <div className={`bg-white rounded-2xl p-5 sm:p-6 border transition-all duration-200 shadow-xs hover:shadow-md hover:border-slate-300 flex flex-col justify-between ${
      accent ? 'border-[#B8935B]/40 ring-1 ring-[#B8935B]/20' : 'border-slate-200/80'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs" style={{ background: bg }}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 ${accent ? 'text-[#B8935B]' : 'text-slate-900'}`}>
          {value !== null && value !== undefined ? value : '—'}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {trendPct !== undefined && <TrendIndicator trendPct={trendPct} trendDirection={trendDirection} />}
          {context && <span className="text-xs text-slate-400 font-medium truncate">{context}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="w-full max-w-7xl 2xl:max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-10 py-6 sm:py-10">
        
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Executive Telemetry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Business Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Real-time telemetry across revenue, client satisfaction, operational SLAs, and revenue flywheel retention.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/analytics/sources"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-[#0A0B0D] via-[#1C1812] to-[#B8935B] text-white text-xs sm:text-sm font-bold rounded-xl hover:opacity-95 transition-all shadow-md shadow-[#B8935B]/15 active:scale-95 shrink-0"
            >
              <span>🔍</span>
              <span>View Data Sources</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-[#B8935B]/20 border-t-[#B8935B] rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Compiling executive analytics from database…</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* ── SECTION 1: EXECUTIVE COMMAND CENTER ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Total Revenue KPI */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#2D2418] text-white p-5 sm:p-6 shadow-md border border-[#B8935B]/30 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF7A]">All-Time Revenue</span>
                  {execData?.revenue?.rateSource && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                      execData.revenue.rateSource === 'live'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {execData.revenue.rateSource} rates
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                    ₹{execData?.revenue?.value != null ? Number(execData.revenue.value).toLocaleString('en-IN') : '—'}
                  </div>
                  <div className="text-xs text-slate-300 mb-2.5">≈ INR equivalent · net transactional revenue</div>
                  
                  {execData?.revenue?.currencyBreakdown?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {execData.revenue.currencyBreakdown.slice(0, 4).map((b: any) => (
                        <span key={b.currency} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-white text-[11px] font-mono font-medium border border-white/15">
                          {b.currency} {Number(b.amount).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {execData?.revenue?.trendPct !== undefined && (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                        (execData.revenue.trendPct ?? 0) >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {(execData.revenue.trendPct ?? 0) >= 0 ? <IconTrendUp size={12} /> : <IconTrendDown size={12} />}
                        {Math.abs(execData.revenue.trendPct ?? 0)}%
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">vs last 30d</span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#B8935B]/10 blur-2xl pointer-events-none" />
              </div>

              {/* Active Clients */}
              <KpiCard
                label="Active Clients"
                value={execData?.activeClients?.value || 0}
                trendPct={execData?.activeClients?.trendPct}
                trendDirection={execData?.activeClients?.trendDirection}
                context="Projects actively underway"
                icon={<IconUser className="text-emerald-600" />}
                bg="#d1fae5"
              />

              {/* NPS Satisfaction */}
              <KpiCard
                label="NPS — Client Satisfaction"
                value={
                  execData?.satisfaction?.value !== null && execData?.satisfaction?.value !== undefined
                    ? execData.satisfaction.value
                    : satData?.lifetime?.nps !== null && satData?.lifetime?.nps !== undefined
                    ? satData.lifetime.nps
                    : 'No Data'
                }
                trendPct={execData?.satisfaction?.trendPct}
                trendDirection={execData?.satisfaction?.trendDirection}
                context={
                  execData?.satisfaction?.value !== null && execData?.satisfaction?.value !== undefined
                    ? `Avg Rating: ${satData?.current?.avgRating ?? '—'} / 5 · last 30d`
                    : satData?.lifetime?.nps !== null && satData?.lifetime?.nps !== undefined
                    ? `Lifetime NPS · Avg: ${satData?.lifetime?.avgRating ?? '—'} / 5`
                    : 'No feedback collected yet'
                }
                icon={<span className="text-violet-600 font-extrabold text-sm">NPS</span>}
                bg="#ede9fe"
              />

              {/* Sales Pipeline Value */}
              <KpiCard
                label="Sales Pipeline Value"
                value={execData?.pipeline?.value ? `₹${Number(execData.pipeline.value).toLocaleString('en-IN')}` : '₹0'}
                trendPct={execData?.pipeline?.trendPct}
                trendDirection={execData?.pipeline?.trendDirection}
                context="Unclosed deals in active stages"
                icon={<IconTrendUp className="text-amber-600" />}
                bg="#fef3c7"
                accent={true}
              />
            </div>

            {/* ── SECTION 2: OPERATIONAL ALERTS ── */}
            <div className="rounded-2xl border-l-4 border-l-rose-500 bg-white border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="bg-rose-50/70 px-5 sm:px-6 py-3.5 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <IconAlert className="text-rose-600" />
                  <div>
                    <h2 className="text-sm font-bold text-rose-950 uppercase tracking-wide">Operational Attention Center</h2>
                    <p className="text-xs text-rose-600 mt-0.5">High-priority items requiring team action</p>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                {(!opsData?.alerts?.nearSlaBreach && !opsData?.alerts?.unreadMessages24h && !opsData?.alerts?.negativeFeedback && !opsData?.alerts?.atRiskClients) ? (
                  <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50/70 px-4 py-3 rounded-xl border border-emerald-100 text-sm font-semibold">
                    <IconCheck size={18} />
                    <span>All operations are running smoothly within SLA thresholds. Zero critical alerts.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {opsData?.alerts?.nearSlaBreach > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                        <span className="text-rose-600 font-bold text-lg leading-none mt-0.5">⚠</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{opsData.alerts.nearSlaBreach} project{opsData.alerts.nearSlaBreach > 1 ? 's' : ''} near SLA deadline</p>
                          <p className="text-xs text-rose-700 mt-0.5">Due within 3 working days — review drafts &amp; prioritize delivery.</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.unreadMessages24h > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-orange-50/60 p-4 rounded-xl border border-orange-100">
                        <span className="text-orange-600 font-bold text-lg leading-none mt-0.5">💬</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{opsData.alerts.unreadMessages24h} client{opsData.alerts.unreadMessages24h > 1 ? 's' : ''} waiting &gt; 24h for reply</p>
                          <p className="text-xs text-orange-700 mt-0.5">Respond before the 48-hour mark to preserve high satisfaction.</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.negativeFeedback > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                        <span className="text-rose-600 font-bold text-lg leading-none mt-0.5">★</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{opsData.alerts.negativeFeedback} low rating feedback submission received</p>
                          <p className="text-xs text-rose-700 mt-0.5">Rating ≤ 2/5 — client relationship intervention recommended.</p>
                        </div>
                      </div>
                    )}
                    {opsData?.alerts?.atRiskClients > 0 && (
                      <div className="flex items-start gap-3 text-slate-700 bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                        <span className="text-rose-600 font-bold text-lg leading-none mt-0.5">📉</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{opsData.alerts.atRiskClients} client{opsData.alerts.atRiskClients > 1 ? 's' : ''} flagged at-risk</p>
                          <p className="text-xs text-rose-700 mt-0.5">Engagement score &lt; 50 — check communication logs.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── SECTION 3: DELIVERY & CLIENT HEALTH ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Delivery Performance */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <IconDocument className="text-slate-500" />
                    Delivery Performance
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">SLA Metrics</span>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Percentage of deliverables completed on or before the committed client SLA deadline.
                </p>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-baseline text-sm mb-2">
                      <span className="text-slate-700 font-bold">On-Time Delivery Rate</span>
                      <span className="font-extrabold text-slate-900 text-2xl">
                        {slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          (slaData?.current?.slaMetPercentage ?? 100) >= 90 ? 'bg-emerald-500' : (slaData?.current?.slaMetPercentage ?? 100) >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${slaData?.current?.slaMetPercentage ?? slaData?.lifetime?.slaMetPercentage ?? 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Target: ≥ 90% SLA Compliance</span>
                      {slaData?.trends?.slaMetTrend !== undefined && (
                        <TrendIndicator trendPct={slaData.trends.slaMetTrend} trendDirection={slaData.trends.slaMetTrend >= 0 ? 'up' : 'down'} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Avg Delivery Time</div>
                      <div className="text-2xl font-extrabold text-slate-900">
                        {slaData?.current?.averageDeliveryTimeDays ?? slaData?.lifetime?.averageDeliveryTimeDays ?? 0}
                        <span className="text-xs font-semibold text-slate-500 ml-1">days</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">From intake to final file delivery</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Avg Revisions / Client</div>
                      <div className="text-2xl font-extrabold text-slate-900">
                        {slaData?.revisionRate ?? 0}
                        <span className="text-xs font-semibold text-slate-500 ml-1">rounds</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Lower indicates clearer briefs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Health Center */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <IconUser className="text-slate-500" />
                    Client Health Overview
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">Score Range: 0–100</span>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Algorithmic client health based on feedback, response speed, and revision status.
                </p>

                {opsData?.health?.totalTracked === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm">Health telemetry will populate as clients onboard.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-baseline gap-3 pb-3 border-b border-slate-100">
                      <div className="text-4xl font-extrabold text-slate-900">{opsData?.health?.averageScore || 0}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">/ 100 Portfolio Avg Health Score</div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs font-bold text-emerald-700">Healthy (≥70)</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(opsData?.health?.healthy / opsData?.health?.totalTracked) * 100}%` }} />
                        </div>
                        <div className="w-8 text-right text-xs font-bold text-slate-700">{opsData?.health?.healthy}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs font-bold text-amber-700">Attention (50–69)</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(opsData?.health?.attentionNeeded / opsData?.health?.totalTracked) * 100}%` }} />
                        </div>
                        <div className="w-8 text-right text-xs font-bold text-slate-700">{opsData?.health?.attentionNeeded}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs font-bold text-rose-700">At Risk (&lt;50)</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(opsData?.health?.atRisk / opsData?.health?.totalTracked) * 100}%` }} />
                        </div>
                        <div className="w-8 text-right text-xs font-bold text-slate-700">{opsData?.health?.atRisk}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* ── SECTION 4: REVENUE BREAKDOWN & MONTHLY CHARTS ── */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <IconTrendUp className="text-[#B8935B]" />
                    Revenue Intelligence &amp; Multi-Stream Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Net converted revenue across brands, channels, and client tiers.
                  </p>
                </div>
                <Link
                  href="/analytics/sources"
                  className="text-xs font-bold text-[#B8935B] hover:text-[#9A7540] hover:underline flex items-center gap-1 w-fit"
                >
                  View exact ledger rows ↗
                </Link>
              </div>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">All-Time Revenue</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {formatCurrency(execData?.revenue?.lifetimeValue || 0, '₹')}
                  </div>
                  {execData?.revenue?.externalRevenue > 0 && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      incl. ₹{Number(execData.revenue.externalRevenue).toLocaleString('en-IN')} external
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Average Client LTV</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {formatCurrency(lifeData?.ltv || 0, '₹')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Across all completed clients</div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Repeat Revenue</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl sm:text-2xl font-extrabold text-emerald-900">
                      {formatCurrency(lifeData?.repeatRevenue || 0, '₹')}
                    </div>
                    {lifeData?.trends?.reactivationTrend > 0 && (
                      <TrendIndicator trendPct={lifeData.trends.reactivationTrend} trendDirection="up" />
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1">From upgrades &amp; returning clients</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Period (30d)</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {formatCurrency(execData?.revenue?.value || 0, '₹')}
                    </div>
                    {execData?.revenue?.trendPct !== undefined && (
                      <TrendIndicator trendPct={execData?.revenue?.trendPct} trendDirection={execData?.revenue?.trendDirection} />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Settled in last 30 calendar days</div>
                </div>
              </div>

              {/* Monthly Chart Container */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-6 border border-slate-100">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>Monthly Settled Revenue (Last 12 Months)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Hover bar for monthly totals</span>
                </div>
                <RevenueBarChart data={chartData?.monthly ?? []} />

                {/* Sub-breakdowns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-200">
                  
                  {/* By Brand */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">By Brand Stream</div>
                    {chartData?.byBrand && chartData.byBrand.length > 0 ? (
                      <div className="space-y-2.5">
                        {chartData.byBrand.map(b => (
                          <div key={b.brand} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600 capitalize">{b.brand || 'Direct'}</span>
                            <span className="font-mono font-bold text-slate-900">{formatCurrency(b.revenue, '₹')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">No brand data recorded.</div>
                    )}
                  </div>

                  {/* By Channel */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">By Acquisition Channel</div>
                    {chartData?.byChannel && chartData.byChannel.length > 0 ? (
                      <div className="space-y-2.5">
                        {chartData.byChannel.map(c => {
                          const channelMap: Record<string, string> = {
                            CLIENTFORGE_INVOICE: 'ClientForge Invoice Portal',
                            DIRECT: 'ClientForge Invoice Portal',
                            MANUAL_PORTAL: 'Manual Portal Onboarding',
                            PAYMENT_GATEWAY_DIRECT: 'Payment Gateway Direct',
                            CLIENT_REFERRAL: 'Client Referral Network',
                            REFERRAL: 'Client Referral Network',
                          };
                          const label = channelMap[c.channel] || c.channel.replace(/_/g, ' ');
                          return (
                            <div key={c.channel} className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-600">{label}</span>
                              <span className="font-mono font-bold text-slate-900">{formatCurrency(c.revenue, '₹')}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">No channel attribution recorded.</div>
                    )}
                  </div>

                  {/* By Tier */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">By Client Tier</div>
                    {chartData?.byTier && chartData.byTier.length > 0 ? (
                      <div className="space-y-2.5">
                        {chartData.byTier.map(t => (
                          <div key={t.tier} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600">{t.tier?.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-bold text-slate-900">{formatCurrency(t.revenue, '₹')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">No tier data recorded.</div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* ── SECTION 5: LIFECYCLE & RETENTION ── */}
            {lifeData?.totalArchived > 0 ? (
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <IconFolder className="text-slate-500" />
                    Client Retention &amp; Flywheel Health
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Tracks retention across completed (archived) clients returning for booster, LinkedIn, or enterprise add-ons.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Archived Clients</div>
                    <div className="text-2xl font-extrabold text-slate-900">{lifeData?.totalArchived}</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Reactivated Clients</div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-extrabold text-slate-900">{lifeData?.totalReactivated}</div>
                      {lifeData?.trends?.reactivationTrend !== undefined && (
                        <TrendIndicator trendPct={lifeData.trends.reactivationTrend} trendDirection={lifeData.trends.reactivationTrend >= 0 ? 'up' : 'down'} />
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Reactivation Rate</div>
                    <div className="text-2xl font-extrabold text-slate-900">{lifeData?.reactivationRate}%</div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider mb-1">Repeat Revenue</div>
                    <div className="text-2xl font-extrabold text-emerald-900">{formatCurrency(lifeData?.repeatRevenue, '₹')}</div>
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        )}
      </div>
    </AppShell>
  );
}
