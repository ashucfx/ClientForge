import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { format } from 'date-fns';

export default async function ProjectMilestonesPage({ params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }
  
  const tenantDb = getTenantDb('ripple_nexus');
  const client = await tenantDb.rnClient.findUnique({
    where: { id: params.id },
    include: {
      serviceModule: true,
      milestones: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { createdAt: 'asc' } } }
      }
    }
  });

  if (!client) {
    redirect('/rn/projects');
  }

  const milestones = client.milestones || [];

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <Link href="/rn/projects" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Projects</Link>
            <span>/</span>
            <Link href={`/rn/projects/${client.id}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{client.companyName || client.name}</Link>
            <span>/</span>
            <span style={{ color: '#fff' }}>Milestones & Sprints</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="rn-title-xl">Sprint Management</h1>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                <span className="rn-subtitle">Track project milestones and tasks</span>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14, borderRadius: 8 }}>
              + Add Milestone
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {milestones.length === 0 ? (
            <div className="rn-panel" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No milestones created yet.</p>
            </div>
          ) : (
            milestones.map((m: any) => (
              <div key={m.id} className="rn-panel">
                <div className="rn-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 className="rn-panel-title" style={{ fontSize: 18 }}>{m.title}</h2>
                    {m.dueDate && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Due: {format(new Date(m.dueDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  <span className={`rn-badge ${m.status === 'APPROVED' ? 'success' : m.status === 'IN_PROGRESS' ? 'brand' : 'neutral'}`}>
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="rn-panel-body" style={{ padding: 0 }}>
                  {m.tasks.map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={t.isCompleted} readOnly style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      <span style={{ color: t.isCompleted ? 'var(--text-tertiary)' : '#fff', textDecoration: t.isCompleted ? 'line-through' : 'none', fontSize: 14 }}>
                        {t.title}
                      </span>
                    </div>
                  ))}
                  <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>+ Add Task</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </RippleNexusShell>
  );
}
