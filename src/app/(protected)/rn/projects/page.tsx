// src/app/(protected)/rn/projects/page.tsx
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { formatDistanceToNow } from 'date-fns';

export default async function RnProjectsPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }
  const tenantDb = getTenantDb('ripple_nexus');
  const clients = await tenantDb.rnClient.findMany({
    include: { serviceModule: true },
    orderBy: { updatedAt: 'desc' },
  });

  const projects = clients.map((c) => {
    const totalStages = Array.isArray(c.serviceModule.workflowStages) ? c.serviceModule.workflowStages.length : 1;
    const completedStages = Array.isArray(c.completedStages) ? c.completedStages.length : 0;
    const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
    
    let status = 'on-track';
    if (c.expectedDeliveryAt && new Date(c.expectedDeliveryAt) < new Date()) {
      status = 'at-risk';
    }

    return {
      id: c.id,
      client: c.companyName || c.name,
      name: c.serviceModule.name,
      phase: c.currentStage.replace(/_/g, ' '),
      status,
      progress,
      lastUpdated: formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true }),
    };
  });

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px' }}>
        <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="rn-title-xl">Active Projects</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>Manage client workspaces and deliverables.</p>
          </div>
          <div>
            <Link href="/rn/projects/new">
              <button className="btn-primary" style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + New Project
              </button>
            </Link>
          </div>
        </header>

        <div className="rn-panel" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--obsidian)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>CLIENT & PROJECT</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>PHASE</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>PROGRESS</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>LAST UPDATED</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '24px' }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.client}</div>
                  </td>
                  <td style={{ padding: '24px' }}>
                    <span className={`rn-badge ${p.status === 'on-track' ? 'success' : 'error'}`}>{p.phase}</span>
                  </td>
                  <td style={{ padding: '24px', width: 250 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--obsidian)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${p.progress}%`, height: '100%', background: p.status === 'on-track' ? 'var(--brand)' : 'var(--error)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 32 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '24px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                    {p.lastUpdated}
                  </td>
                  <td style={{ padding: '24px', textAlign: 'right' }}>
                    <Link href={`/rn/projects/${p.id}`}>
                      <button className="btn-secondary" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Open Workspace
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <style dangerouslySetInnerHTML={{__html: `
        .table-row-hover:hover { background: var(--surface-2); }
      `}} />
    </RippleNexusShell>
  );
}
