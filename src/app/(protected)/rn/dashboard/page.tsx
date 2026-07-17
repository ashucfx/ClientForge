// src/app/(protected)/rn/dashboard/page.tsx — Executive Overview v2
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { prisma } from '@/lib/db';
import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import type { RnClient, RnServiceModule, RnRetainer } from '@prisma/client';

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

type ClientWithModule = RnClient & { serviceModule: RnServiceModule };
type RetainerWithClient = RnRetainer & { client: { name: string; companyName: string | null } };

export default async function RnDashboardPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');

  const [clients, pendingApprovals, unreadMessages, recentLogs, breachedSla, upcomingHoliday, retainers] = await Promise.all([
    tenantDb.rnClient.findMany({
      include: { serviceModule: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ClientWithModule[]>,
    tenantDb.rnDeliverable.count({ where: { approvalStatus: 'PENDING' } }),
    tenantDb.rnMessage.count({ where: { authorType: 'client', readByAdmin: false } }),
    tenantDb.rnActivityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { client: true },
    }),
    tenantDb.conversationReadState.findMany({
      where: { rnClientId: { not: null }, adminSlaDeadline: { lt: new Date() } },
      take: 5,
    }),
    prisma.rnHoliday.findFirst({
      where: { date: { gte: new Date() }, isGuested: true },
      orderBy: { date: 'asc' },
    }),
    // Use prisma directly for RN-only model (no brandId scoping needed)
    prisma.rnRetainer.findMany({
      where: { status: 'ACTIVE' },
      include: { client: { select: { name: true, companyName: true } } },
      orderBy: { nextBillingAt: 'asc' },
    }) as Promise<RetainerWithClient[]>,
  ]);

  const activeClients = clients.filter((c: ClientWithModule) => c.currentStage !== 'COMPLETED' && c.lifecycleStatus === 'ACTIVE');
  const atRiskClients = activeClients.filter((c: ClientWithModule) => c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date());
  const completed = clients.filter((c: ClientWithModule) => c.completedAt);

  const activeProjects = activeClients.map((c: ClientWithModule) => {
    const isAtRisk = !!(c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date());
    const workflowStages = Array.isArray(c.serviceModule.workflowStages) ? c.serviceModule.workflowStages as string[] : [];
    const completedStages = Array.isArray(c.completedStages) ? c.completedStages as string[] : [];
    const progress = workflowStages.length > 0 ? Math.round((completedStages.length / workflowStages.length) * 100) : 0;
    return {
      id: c.id,
      client: c.companyName || c.name,
      project: c.serviceModule.name,
      phase: c.currentStage.replace(/_/g, ' '),
      progress,
      status: isAtRisk ? 'at-risk' : 'on-track',
      nextMilestone: c.expectedDeliveryAt ? format(new Date(c.expectedDeliveryAt), 'MMM d') : 'TBD',
      waitingOn: c.waitingOn,
    };
  });

  const upcoming = activeClients
    .filter((c: ClientWithModule) => c.expectedDeliveryAt)
    .map((c: ClientWithModule) => ({
      id: c.id,
      client: c.companyName || c.name,
      service: c.serviceModule.name,
      days: differenceInCalendarDays(new Date(c.expectedDeliveryAt!), new Date()),
      date: format(new Date(c.expectedDeliveryAt!), 'MMM d'),
    }))
    .filter(d => d.days >= 0 && d.days <= 14)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  const stageCounts = new Map<string, number>();
  for (const c of activeClients) {
    const s = c.currentStage.replace(/_/g, ' ');
    stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
  }
  const stageDist = Array.from(stageCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxStage = Math.max(1, ...stageDist.map(([, n]) => n));

  const breachedClientIds = breachedSla.map(b => b.rnClientId).filter(Boolean) as string[];
  const breachedClients = clients.filter((c: ClientWithModule) => breachedClientIds.includes(c.id));

  const retainersByCurrency = new Map<string, number>();
  for (const c of activeClients) {
    if (!c.amountPaid) continue;
    retainersByCurrency.set(c.currency, (retainersByCurrency.get(c.currency) ?? 0) + c.amountPaid);
  }
  const retainerValue = retainersByCurrency.size === 0
    ? '—'
    : Array.from(retainersByCurrency.entries()).sort((a, b) => b[1] - a[1]).map(([cur, amt]) => formatMoney(amt, cur)).join(' + ');

  const avgDeliveryDays = completed.length
    ? Math.round(completed.reduce((sum: number, c: ClientWithModule) => sum + Math.max(0, differenceInCalendarDays(new Date(c.completedAt!), new Date(c.createdAt))), 0) / completed.length)
    : null;

  const metrics = [
    { label: 'Active Retainers',    value: retainerValue,   sub: `${activeClients.length} active project${activeClients.length !== 1 ? 's' : ''}`, up: true,  icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> },
    { label: 'Projects On Track',   value: `${activeClients.length - atRiskClients.length}/${activeClients.length}`, sub: atRiskClients.length ? `${atRiskClients.length} at risk` : 'All on schedule', up: atRiskClients.length === 0, icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
    { label: 'Pending Approvals',   value: String(pendingApprovals),  sub: pendingApprovals ? 'Awaiting review' : 'Nothing pending',    up: pendingApprovals === 0, icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    { label: 'Unread Messages',     value: String(unreadMessages),    sub: avgDeliveryDays ? `Avg delivery ${avgDeliveryDays}d` : 'No completions yet', up: unreadMessages === 0, icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> },
  ];

  const recentActivity = (recentLogs as Array<{ id: string; clientId: string; action: string; performedBy: string; createdAt: Date; client: { name: string; companyName: string | null } }>).map(log => ({
    id: log.id,
    clientId: log.clientId,
    content: `${log.client.companyName || log.client.name}: ${log.action}`,
    by: log.performedBy,
    time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
  }));

  const daysToNextHoliday = upcomingHoliday ? differenceInCalendarDays(new Date(upcomingHoliday.date), new Date()) : null;

  return (
    <RippleNexusShell>
      <main className="rn-page">

        {/* Header */}
        <header className="rn-page-header">
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 8 }}>The Autonomous Enterprise Stack</div>
            <h1 className="rn-title-xl">Executive Overview</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              {greeting()}. Here&rsquo;s the current operational status for Ripple Nexus.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/rn/inbox" className="btn-secondary">
              Inbox{unreadMessages > 0 ? ` (${unreadMessages})` : ''}
            </Link>
            <Link href="/rn/invoices/new" className="btn-secondary">New Invoice</Link>
            <Link href="/rn/projects/new" className="btn-primary">+ New Project</Link>
          </div>
        </header>

        {/* SLA breach alert */}
        {breachedClients.length > 0 && (
          <div className="rn-alert danger" style={{ marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', color: 'var(--danger)', marginRight: 12 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <strong>{breachedClients.length} response SLA{breachedClients.length !== 1 ? 's' : ''} breached — </strong>
              {breachedClients.slice(0, 3).map((c: ClientWithModule, i: number) => (
                <Link key={c.id} href={`/rn/inbox?client=${c.id}`} style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: i ? 8 : 0 }}>
                  {c.companyName || c.name}
                </Link>
              ))}
              {breachedClients.length > 3 && <span> +{breachedClients.length - 3} more</span>}
            </div>
          </div>
        )}

        {/* Holiday notice */}
        {upcomingHoliday && daysToNextHoliday !== null && daysToNextHoliday <= 7 && (
          <div className="rn-alert info" style={{ marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', color: 'var(--cyan)', marginRight: 12 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <strong style={{ color: 'var(--cyan)' }}>Agency closure in {daysToNextHoliday === 0 ? 'today' : `${daysToNextHoliday} day${daysToNextHoliday !== 1 ? 's' : ''}`}:</strong>
              {' '}{upcomingHoliday.name} — {format(new Date(upcomingHoliday.date), 'EEEE, MMM d')}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="rn-metrics-grid">
          {metrics.map((m, i) => (
            <div key={i} className="rn-stat-card hover-lift">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', color: m.up ? 'var(--brand)' : 'var(--danger)' }}>
                  {m.icon}
                </div>
                <span className={`rn-badge ${m.up ? 'success' : 'warning'}`} style={{ fontSize: 11 }}>
                  {m.up ? '↑ Good' : '↓ Needs attention'}
                </span>
              </div>
              <div className="rn-eyebrow" style={{ marginBottom: 6, fontSize: 11 }}>{m.label}</div>
              <div className="rn-stat-value" style={{ marginBottom: 6, fontSize: 28, overflowWrap: 'anywhere' }}>{m.value}</div>
              <div style={{ fontSize: 12.5, color: m.up ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="rn-dash-grid" style={{ marginBottom: 24 }}>
          {/* Active Projects Pipeline */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Active Projects Pipeline
              </h2>
              <Link href="/rn/projects" className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>View All</Link>
            </div>
            <div className="rn-panel-body" style={{ padding: 0 }}>
              {activeProjects.length === 0 ? (
                <div className="rn-empty" style={{ padding: '40px 24px' }}>
                  <div className="rn-empty-icon" style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <p className="rn-empty-title">No active projects</p>
                  <p className="rn-empty-desc">Create your first project to get started</p>
                  <Link href="/rn/projects/new" className="btn-primary" style={{ marginTop: 8 }}>+ New Project</Link>
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Client / Project</th>
                      <th>Phase</th>
                      <th>Progress</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.slice(0, 8).map(p => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/rn/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{p.client}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.project}</div>
                          </Link>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className={`rn-badge ${p.status === 'on-track' ? 'success' : 'warning'}`}>{p.phase}</span>
                            {p.waitingOn === 'CLIENT' && (
                              <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Waiting on client
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 110 }}>
                            <div className="rn-progress-track">
                              <div className={`rn-progress-fill${p.status === 'at-risk' ? ' warning' : ''}`} style={{ width: `${p.progress}%` }} />
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', width: 34, flexShrink: 0 }}>{p.progress}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: p.status === 'at-risk' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                          {p.nextMilestone}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Operational Feed */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Operational Feed
              </h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recentActivity.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '24px 0' }}>No activity yet.</div>
              ) : recentActivity.map(activity => (
                <div key={activity.id} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--brand)', marginTop: 6, flexShrink: 0, boxShadow: 'var(--glow-sm)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>{activity.content}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{activity.time}</span>
                      <Link href={`/rn/projects/${activity.clientId}`} style={{ color: 'var(--plasma)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <Link href="/rn/inbox" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>Open Inbox →</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="rn-two-col" style={{ marginBottom: 24 }}>
          {/* Upcoming deadlines */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upcoming Deadlines
              </h2>
              <span className="rn-badge neutral">Next 14 days</span>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcoming.length === 0 ? (
                <div className="rn-empty" style={{ padding: '24px 0' }}>
                  <div className="rn-empty-icon" style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)' }}>
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="rn-empty-desc">Nothing due in the next two weeks</p>
                </div>
              ) : upcoming.map(d => (
                <Link key={d.id} href={`/rn/projects/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', gap: 12, padding: '10px 14px', background: 'var(--surface-3)', borderRadius: 12, border: '1px solid var(--border)', transition: 'all 180ms var(--ease)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{d.client}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.service}</div>
                  </div>
                  <span className={`rn-badge ${d.days <= 3 ? 'danger' : d.days <= 7 ? 'warning' : 'neutral'}`} style={{ flexShrink: 0 }}>
                    {d.days === 0 ? 'Today' : `${d.days}d · ${d.date}`}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Stage distribution */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Pipeline by Stage
              </h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stageDist.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>No active projects.</div>
              ) : stageDist.map(([stage, count]) => (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{stage.toLowerCase()}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{count}</span>
                  </div>
                  <div className="rn-progress-track">
                    <div className="rn-progress-fill" style={{ width: `${(count / maxStage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Retainers strip */}
        {retainers.length > 0 && (
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Active Retainers
              </h2>
              <Link href="/rn/retainers" className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>Manage</Link>
            </div>
            <div className="rn-panel-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th>Client</th><th>Plan</th><th>Amount</th><th>Next Billing</th><th>Gateway</th></tr>
                </thead>
                <tbody>
                  {retainers.slice(0, 5).map((r: RetainerWithClient) => {
                    const sym = CURRENCY_SYMBOLS[r.currency] ?? r.currency;
                    const daysLeft = differenceInCalendarDays(new Date(r.nextBillingAt), new Date());
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.client.companyName || r.client.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.name}</div>
                        </td>
                        <td><span className="rn-badge brand">{r.type}</span></td>
                        <td style={{ fontWeight: 700 }}>{sym}{r.amount.toLocaleString()}</td>
                        <td>
                          <span className={`rn-badge ${daysLeft <= 3 ? 'warning' : 'neutral'}`}>
                            {daysLeft <= 0 ? 'Due today' : `in ${daysLeft}d · ${format(new Date(r.nextBillingAt), 'MMM d')}`}
                          </span>
                        </td>
                        <td>
                          <span className={`rn-badge ${r.paymentGateway === 'PAYPAL' ? 'cyan' : 'brand'}`} style={{ fontSize: 10.5, textTransform: 'uppercase' }}>
                            {r.paymentGateway}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </RippleNexusShell>
  );
}
