// src/app/(protected)/rn/reports/page.tsx — Agency Analytics
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { format, subMonths, startOfMonth, differenceInCalendarDays } from 'date-fns';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CURRENCY_SYMBOLS[cur] ?? `${cur} `}${Math.round(amt).toLocaleString()}`;

export default async function RnReportsPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));

  const [paidInvoices, clients, deliverables, reviews, paidMilestones] = await Promise.all([
    prisma.invoice.findMany({
      where: { brandId: 'ripple_nexus', status: { in: ['PAID', 'PARTIALLY_PAID'] }, createdAt: { gte: twelveMonthsAgo } },
      select: { totalPayable: true, currency: true, createdAt: true, paidAt: true, status: true },
    }),
    prisma.rnClient.findMany({
      include: { serviceModule: { select: { name: true } } },
    }),
    prisma.rnDeliverable.groupBy({
      by: ['approvalStatus'],
      _count: { _all: true },
    }),
    prisma.feedback.findMany({
      where: { rnClientId: { not: null } },
      select: { rating: true, npsScore: true },
    }),
    prisma.rnProjectMilestone.findMany({
      where: { paymentStatus: 'PAID' },
      select: { amount: true, currency: true, paidAt: true, title: true },
    }),
  ]);

  /* ── Revenue by source: invoices vs milestone payments ── */
  const milestoneRevenue = new Map<string, number>();
  for (const m of paidMilestones) {
    milestoneRevenue.set(m.currency, (milestoneRevenue.get(m.currency) ?? 0) + m.amount);
  }

  /* ── Revenue by month (per currency) ── */
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) monthKeys.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  const revenueByMonth = new Map<string, Map<string, number>>();
  for (const inv of paidInvoices) {
    const key = format(new Date(inv.paidAt ?? inv.createdAt), 'yyyy-MM');
    if (!revenueByMonth.has(key)) revenueByMonth.set(key, new Map());
    const byCur = revenueByMonth.get(key)!;
    byCur.set(inv.currency, (byCur.get(inv.currency) ?? 0) + inv.totalPayable);
  }
  // Chart in the dominant currency; list others alongside
  const currencyTotals = new Map<string, number>();
  for (const byCur of Array.from(revenueByMonth.values())) {
    for (const [cur, amt] of Array.from(byCur.entries())) currencyTotals.set(cur, (currencyTotals.get(cur) ?? 0) + amt);
  }
  const primaryCurrency = Array.from(currencyTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INR';
  const monthlySeries = monthKeys.map(k => ({
    label: format(new Date(`${k}-01T00:00:00`), 'MMM'),
    value: revenueByMonth.get(k)?.get(primaryCurrency) ?? 0,
  }));
  const maxMonthly = Math.max(1, ...monthlySeries.map(m => m.value));

  /* ── Delivery performance ── */
  const completedClients = clients.filter(c => c.completedAt);
  const avgDelivery = completedClients.length
    ? Math.round(completedClients.reduce((s, c) => s + Math.max(0, differenceInCalendarDays(new Date(c.completedAt!), new Date(c.createdAt))), 0) / completedClients.length)
    : null;
  const onTime = completedClients.filter(c => !c.expectedDeliveryAt || new Date(c.completedAt!) <= new Date(c.expectedDeliveryAt)).length;
  const onTimeRate = completedClients.length ? Math.round((onTime / completedClients.length) * 100) : null;

  /* ── Client leaderboard ── */
  const leaderboard = [...clients]
    .filter(c => c.amountPaid > 0)
    .sort((a, b) => b.amountPaid - a.amountPaid)
    .slice(0, 8);
  const maxRevenue = Math.max(1, ...leaderboard.map(c => c.amountPaid));

  /* ── Approvals + satisfaction ── */
  const approvalCounts: Record<string, number> = {};
  for (const g of deliverables) approvalCounts[g.approvalStatus] = g._count._all;
  const totalDeliverables = Object.values(approvalCounts).reduce((a, b) => a + b, 0);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const avgNps = reviews.length ? Math.round(reviews.reduce((s, r) => s + r.npsScore, 0) / reviews.length) : null;

  /* ── Service mix ── */
  const serviceCounts = new Map<string, number>();
  for (const c of clients) {
    const name = c.serviceModule?.name ?? 'Unassigned';
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const serviceMix = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxService = Math.max(1, ...serviceMix.map(([, n]) => n));

  const headline = [
    { label: `Revenue (12 mo, ${primaryCurrency})`, value: money(currencyTotals.get(primaryCurrency) ?? 0, primaryCurrency), sub: Array.from(currencyTotals.entries()).filter(([c]) => c !== primaryCurrency).map(([c, a]) => money(a, c)).join(' + ') || 'single currency' },
    { label: 'Completed Projects', value: String(completedClients.length), sub: onTimeRate !== null ? `${onTimeRate}% on time` : 'no completions yet' },
    { label: 'Avg Delivery Time', value: avgDelivery !== null ? `${avgDelivery} days` : '—', sub: `${clients.filter(c => c.lifecycleStatus === 'ACTIVE' && c.currentStage !== 'COMPLETED').length} in flight` },
    { label: 'Client Satisfaction', value: avgRating ? `${avgRating} / 5` : '—', sub: avgNps !== null ? `NPS ${avgNps}` : 'no feedback yet' },
  ];

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <header style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Operations</div>
            <h1 className="rn-title-xl">Reports</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>Agency performance across revenue, delivery, and client satisfaction.</p>
          </div>
          <a href="/api/rn/projects/export" className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13, textDecoration: 'none' }}>
            Export Projects CSV
          </a>
        </header>

        {/* Headline stats */}
        <div className="rn-metrics-grid">
          {headline.map((m, i) => (
            <div key={i} className="rn-panel" style={{ padding: 24 }}>
              <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>{m.label}</div>
              <div className="rn-stat-value" style={{ marginBottom: 8, overflowWrap: 'anywhere' }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="rn-panel" style={{ marginBottom: 24 }}>
          <div className="rn-panel-header">
            <h2 className="rn-panel-title">Revenue — last 12 months ({primaryCurrency})</h2>
          </div>
          <div className="rn-panel-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
              {monthlySeries.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    title={money(m.value, primaryCurrency)}
                    style={{
                      width: '100%', maxWidth: 42, borderRadius: '6px 6px 2px 2px',
                      height: `${Math.max(m.value > 0 ? 4 : 1, Math.round((m.value / maxMonthly) * 100))}%`,
                      background: m.value > 0 ? 'var(--rn-gradient)' : 'var(--surface-3)',
                      opacity: m.value > 0 ? 1 : 0.6,
                    }}
                  />
                  <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rn-two-col" style={{ marginBottom: 24 }}>
          {/* Client leaderboard */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Top Clients by Revenue</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {leaderboard.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>No revenue recorded yet.</div>
              )}
              {leaderboard.map(c => (
                <Link key={c.id} href={`/rn/projects/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.companyName || c.name}</span>
                    <span className="rn-proof">{money(c.amountPaid, c.currency)}</span>
                  </div>
                  <div className="rn-progress-track">
                    <div className="rn-progress-fill" style={{ width: `${(c.amountPaid / maxRevenue) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Service mix */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Service Mix</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {serviceMix.map(([name, count]) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{name}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{count}</span>
                  </div>
                  <div className="rn-progress-track">
                    <div className="rn-progress-fill" style={{ width: `${(count / maxService) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue by source */}
        <div className="rn-panel" style={{ marginBottom: 24 }}>
          <div className="rn-panel-header">
            <h2 className="rn-panel-title">Revenue by Source</h2>
          </div>
          <div className="rn-panel-body" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>Invoiced (12 mo)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                {Array.from(currencyTotals.entries()).map(([c, a]) => money(a, c)).join(' + ') || '—'}
              </div>
            </div>
            <div>
              <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>Milestone Payments (all time)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }} className="rn-proof">
                {milestoneRevenue.size > 0
                  ? Array.from(milestoneRevenue.entries()).map(([c, a]) => money(a, c)).join(' + ')
                  : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {paidMilestones.length} paid milestone{paidMilestones.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        {/* Deliverable approvals */}
        <div className="rn-panel">
          <div className="rn-panel-header">
            <h2 className="rn-panel-title">Deliverable Approvals</h2>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{totalDeliverables} total</span>
          </div>
          <div className="rn-panel-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { key: 'APPROVED', label: 'Approved', cls: 'success' },
              { key: 'PENDING', label: 'Pending Review', cls: 'neutral' },
              { key: 'CHANGES_REQUESTED', label: 'Changes Requested', cls: 'warning' },
            ].map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`rn-badge ${s.cls}`}>{s.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{approvalCounts[s.key] ?? 0}</span>
                {totalDeliverables > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {Math.round(((approvalCounts[s.key] ?? 0) / totalDeliverables) * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
