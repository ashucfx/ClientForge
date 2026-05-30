// src/app/(protected)/rn/dashboard/page.tsx
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default async function RnDashboardPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');

  // Fetch all active projects
  const clients = await tenantDb.rnClient.findMany({
    include: { serviceModule: true },
    orderBy: { createdAt: 'desc' }
  });

  const activeClients = clients.filter(c => c.currentStage !== 'COMPLETED');
  const atRiskClients = activeClients.filter(c => c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date());

  const activeProjects = activeClients.map(c => {
    let status = 'on-track';
    if (c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date()) {
      status = 'at-risk';
    }

    const workflowStages = Array.isArray(c.serviceModule.workflowStages) ? c.serviceModule.workflowStages : [];
    const completedStages = Array.isArray(c.completedStages) ? c.completedStages : [];
    const progress = workflowStages.length > 0 ? Math.round((completedStages.length / workflowStages.length) * 100) : 0;
    
    return {
      id: c.id,
      client: c.companyName || c.name,
      project: c.serviceModule.name,
      phase: c.currentStage,
      progress,
      status,
      nextMilestone: c.expectedDeliveryAt ? format(new Date(c.expectedDeliveryAt), 'MMM d') : 'TBD'
    };
  });

  // Calculate metrics
  const totalRetainers = activeClients.reduce((sum, c) => sum + (c.amountPaid || 0), 0);

  // Fetch recent activity
  const recentLogs = await tenantDb.rnActivityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { client: true }
  });

  const recentActivity = recentLogs.map(log => ({
    id: log.id,
    type: 'activity',
    content: `${log.client.companyName || log.client.name}: ${log.performedBy} ${log.action}`,
    time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
    action: 'View'
  }));

  const metrics = [
    { label: 'Active Retainers', value: `₹${totalRetainers.toLocaleString()}`, trend: 'Live', isUp: true },
    { label: 'Projects On Track', value: `${activeClients.length - atRiskClients.length} / ${activeClients.length}`, trend: `${atRiskClients.length} At Risk`, isUp: atRiskClients.length === 0 },
    { label: 'Pending Approvals', value: '-', trend: 'Under Construction', isUp: false },
    { label: 'Avg. Delivery Time', value: '14 Days', trend: '-2.4 Days', isUp: true },
  ];

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px' }}>
        
        {/* Header Section */}
        <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="rn-title-xl">Executive Overview</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>Good morning. Here is the current operational status for Ripple Nexus.</p>
          </div>
          <div>
            <Link href="/rn/projects/new">
              <button className="btn-primary" style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + New Project
              </button>
            </Link>
          </div>
        </header>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 40 }}>
          {metrics.map((m, i) => (
            <div key={i} className="rn-panel" style={{ padding: 24 }}>
              <div className="rn-subtitle" style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{m.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>{m.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: m.isUp ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.trend}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
          {/* Active Projects Timeline Array */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Active Projects Pipeline</h2>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}>View All</button>
            </div>
            <div className="rn-panel-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>CLIENT / PROJECT</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>PHASE</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>PROGRESS</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>NEXT MILESTONE</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{p.client}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.project}</div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span className={`rn-badge ${p.status === 'on-track' ? 'success' : 'warning'}`}>
                          {p.phase}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--obsidian)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${p.progress}%`, height: '100%', background: p.status === 'on-track' ? 'var(--brand)' : 'var(--warning)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 32 }}>{p.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', fontSize: 13, color: p.status === 'at-risk' ? 'var(--error)' : 'var(--text-secondary)' }}>
                        {p.nextMilestone}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Items Feed */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Operational Feed</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {recentActivity.map((activity) => (
                <div key={activity.id} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--brand)', marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>
                      {activity.content}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activity.time}</span>
                      <button style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{activity.action} →</button>
                    </div>
                  </div>
                </div>
              ))}
              
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>View All Activity</button>
              </div>
            </div>
          </div>
        </div>

      </main>
      <style dangerouslySetInnerHTML={{__html: `
        .table-row-hover:hover { background: var(--surface-2); }
      `}} />
    </RippleNexusShell>
  );
}
