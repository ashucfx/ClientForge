// src/app/(protected)/rn/dashboard/page.tsx — Executive Overview
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };

function formatMoney(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function RnDashboardPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');

  const [clients, pendingApprovals, unreadMessages, recentLogs, breachedSla] = await Promise.all([
    tenantDb.rnClient.findMany({
      include: { serviceModule: true },
      orderBy: { createdAt: 'desc' },
    }),
    tenantDb.rnDeliverable.count({ where: { approvalStatus: 'PENDING' } }),
    tenantDb.rnMessage.count({ where: { authorType: 'client', readByAdmin: false } }),
    tenantDb.rnActivityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { client: true },
    }),
    tenantDb.conversationReadState.findMany({
      where: { rnClientId: { not: null }, adminSlaDeadline: { lt: new Date() } },
      take: 5,
    }),
  ]);

  const activeClients = clients.filter(c => c.currentStage !== 'COMPLETED' && c.lifecycleStatus === 'ACTIVE');
  const atRiskClients = activeClients.filter(c => c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date());

  const activeProjects = activeClients.map(c => {
    const isAtRisk = !!(c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date());
    const workflowStages = Array.isArray(c.serviceModule.workflowStages) ? c.serviceModule.workflowStages : [];
    const completedStages = Array.isArray(c.completedStages) ? c.completedStages : [];
    const progress = workflowStages.length > 0 ? Math.round((completedStages.length / workflowStages.length) * 100) : 0;

    return {
      id: c.id,
      client: c.companyName || c.name,
      project: c.serviceModule.name,
      phase: c.currentStage.replace(/_/g, ' '),
      progress,
      status: isAtRisk ? 'at-risk' : 'on-track',
      nextMilestone: c.expectedDeliveryAt ? format(new Date(c.expectedDeliveryAt), 'MMM d') : 'TBD',
    };
  });

  // Upcoming deadlines (next 14 days)
  const now = Date.now();
  const upcoming = activeClients
    .filter(c => c.expectedDeliveryAt)
    .map(c => ({
      id: c.id,
      client: c.companyName || c.name,
      service: c.serviceModule.name,
      days: differenceInCalendarDays(new Date(c.expectedDeliveryAt!), new Date()),
      date: format(new Date(c.expectedDeliveryAt!), 'MMM d'),
    }))
    .filter(d => d.days >= 0 && d.days <= 14)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  // Stage distribution
  const stageCounts = new Map<string, number>();
  for (const c of activeClients) {
    const s = c.currentStage.replace(/_/g, ' ');
    stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
  }
  const stageDist = Array.from(stageCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxStage = Math.max(1, ...stageDist.map(([, n]) => n));

  // SLA breaches → map to clients
  const breachedClientIds = breachedSla.map(b => b.rnClientId).filter(Boolean) as string[];
  const breachedClients = clients.filter(c => breachedClientIds.includes(c.id));

  // Metrics
  const retainersByCurrency = new Map<string, number>();
  for (const c of activeClients) {
    if (!c.amountPaid) continue;
    retainersByCurrency.set(c.currency, (retainersByCurrency.get(c.currency) ?? 0) + c.amountPaid);
  }
  const retainerValue = retainersByCurrency.size === 0
    ? '—'
    : Array.from(retainersByCurrency.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cur, amt]) => formatMoney(amt, cur))
        .join(' + ');

  const completed = clients.filter(c => c.completedAt);
  const avgDeliveryDays = completed.length
    ? Math.round(
        completed.reduce((sum, c) => sum + Math.max(0, differenceInCalendarDays(new Date(c.completedAt!), new Date(c.createdAt))), 0) /
          completed.length
      )
    : null;

  const metrics = [
    {
      label: 'Active Retainers',
      value: retainerValue,
      trend: `${activeClients.length} active project${activeClients.length === 1 ? '' : 's'}`,
      isUp: true,
    },
    {
      label: 'Projects On Track',
      value: `${activeClients.length - atRiskClients.length} / ${activeClients.length}`,
      trend: atRiskClients.length ? `${atRiskClients.length} at risk` : 'All on schedule',
      isUp: atRiskClients.length === 0,
    },
    {
      label: 'Pending Approvals',
      value: String(pendingApprovals),
      trend: pendingApprovals ? 'Awaiting client review' : 'Nothing pending',
      isUp: pendingApprovals === 0,
    },
    {
      label: 'Unread Messages',
      value: String(unreadMessages),
      trend: avgDeliveryDays !== null ? `Avg delivery ${avgDeliveryDays} days` : 'No completed projects yet',
      isUp: unreadMessages === 0,
    },
  ];

  const recentActivity = recentLogs.map(log => ({
    id: log.id,
    clientId: log.clientId,
    content: `${log.client.companyName || log.client.name}: ${log.performedBy} ${log.action}`,
    time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
  }));

  return (
    <RippleNexusShell>
      <main className="rn-page">

        {/* Header Section */}
        <header style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>The Autonomous Enterprise Stack</div>
            <h1 className="rn-title-xl">Executive Overview</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>{greeting()}. Here is the current operational status for Ripple Nexus.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/rn/inbox" className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13, textDecoration: 'none' }}>
              Inbox{unreadMessages > 0 ? ` (${unreadMessages})` : ''}
            </Link>
            <Link href="/rn/invoices/new" className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13, textDecoration: 'none' }}>
              New Invoice
            </Link>
            <Link href="/rn/projects/new">
              <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + New Project
              </button>
            </Link>
          </div>
        </header>

        {/* SLA breach alert */}
        {breachedClients.length > 0 && (
          <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger)', fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>⏱ {breachedClients.length} response SLA{breachedClients.length === 1 ? '' : 's'} breached — </span>
            {breachedClients.slice(0, 3).map((c, i) => (
              <Link key={c.id} href={`/rn/inbox?client=${c.id}`} style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: i ? 8 : 4 }}>
                {c.companyName || c.name}
              </Link>
            ))}
            {breachedClients.length > 3 && <span style={{ color: 'var(--danger)' }}> +{breachedClients.length - 3} more</span>}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="rn-metrics-grid">
          {metrics.map((m, i) => (
            <div key={i} className="rn-panel hover-lift" style={{ padding: 24 }}>
              <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>{m.label}</div>
              <div className="rn-stat-value" style={{ marginBottom: 8, overflowWrap: 'anywhere' }}>{m.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: m.isUp ? 'var(--success)' : 'var(--warning)' }}>
                {m.trend}
              </div>
            </div>
          ))}
        </div>

        <div className="rn-dash-grid" style={{ marginBottom: 24 }}>
          {/* Active Projects Pipeline */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Active Projects Pipeline</h2>
              <Link href="/rn/projects" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}>View All</Link>
            </div>
            <div className="rn-panel-body table-scroll-wrapper" style={{ padding: 0 }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Client / Project</th>
                    <th>Phase</th>
                    <th>Progress</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                        No active projects. <Link href="/rn/projects/new" style={{ color: 'var(--plasma)', fontWeight: 600 }}>Start one →</Link>
                      </td>
                    </tr>
                  ) : activeProjects.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/rn/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.client}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.project}</div>
                        </Link>
                      </td>
                      <td>
                        <span className={`rn-badge ${p.status === 'on-track' ? 'success' : 'warning'}`}>
                          {p.phase}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 120 }}>
                          <div className="rn-progress-track">
                            <div className={`rn-progress-fill${p.status === 'at-risk' ? ' warning' : ''}`} style={{ width: `${p.progress}%` }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 36 }}>{p.progress}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: p.status === 'at-risk' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {p.nextMilestone}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Feed */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Operational Feed</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {recentActivity.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '24px 0' }}>
                  No activity yet.
                </div>
              )}
              {recentActivity.map((activity) => (
                <div key={activity.id} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--brand)', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>
                      {activity.content}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activity.time}</span>
                      <Link href={`/rn/projects/${activity.clientId}`} style={{ color: 'var(--plasma)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <Link href="/rn/inbox" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>Open Inbox →</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: deadlines + stage distribution */}
        <div className="rn-two-col">
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Upcoming Deadlines (14 days)</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {upcoming.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>
                  Nothing due in the next two weeks.
                </div>
              )}
              {upcoming.map(d => (
                <Link key={d.id} href={`/rn/projects/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.client}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{d.service}</div>
                  </div>
                  <span className={`rn-badge ${d.days <= 3 ? 'danger' : d.days <= 7 ? 'warning' : 'neutral'}`} style={{ flexShrink: 0 }}>
                    {d.days === 0 ? 'Today' : `${d.days}d · ${d.date}`}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Pipeline by Stage</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stageDist.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>
                  No active projects.
                </div>
              )}
              {stageDist.map(([stage, count]) => (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{stage.toLowerCase()}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{count}</span>
                  </div>
                  <div className="rn-progress-track">
                    <div className="rn-progress-fill" style={{ width: `${(count / maxStage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </RippleNexusShell>
  );
}
