// src/app/(protected)/rn/projects/[id]/page.tsx
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { formatDistanceToNow, format } from 'date-fns';
import { MessageInput, AdvanceStageButton, UploadDeliverableButton } from '@/components/rn/ProjectMutations';

export default async function RnProjectCockpitPage({ params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }
  const tenantDb = getTenantDb('ripple_nexus');
  const client = await tenantDb.rnClient.findUnique({
    where: { id: params.id },
    include: {
      serviceModule: true,
      deliverables: { orderBy: { createdAt: 'desc' } },
      messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  });

  if (!client) {
    redirect('/rn/projects');
  }

  let status = 'on-track';
  if (client.expectedDeliveryAt && new Date(client.expectedDeliveryAt) < new Date()) {
    status = 'at-risk';
  }

  const project = {
    id: client.id,
    name: client.serviceModule.name,
    client: client.companyName || client.name,
    health: status,
    startDate: format(new Date(client.createdAt), 'MMM d, yyyy'),
    deadline: client.expectedDeliveryAt ? format(new Date(client.expectedDeliveryAt), 'MMM d, yyyy') : 'TBD',
    budget: `${client.currency} ${client.amountPaid.toLocaleString()}`,
  };

  // Convert DB stages to milestones timeline
  const completedArr = Array.isArray(client.completedStages) ? client.completedStages : [];
  const milestones = (Array.isArray(client.serviceModule.workflowStages) ? client.serviceModule.workflowStages : []).map((stage: any, i) => {
    let mStatus = 'upcoming';
    if (completedArr.includes(stage)) mStatus = 'completed';
    else if (stage === client.currentStage) mStatus = 'active';

    return {
      id: `m_${i}`,
      title: typeof stage === 'string' ? stage.replace(/_/g, ' ') : stage,
      status: mStatus,
      date: mStatus === 'completed' ? 'Done' : mStatus === 'active' ? 'Current' : 'Pending'
    };
  });

  const deliverables = client.deliverables.map(d => ({
    id: d.id,
    title: d.originalName || d.label || 'Unnamed Asset',
    type: d.mimeType?.includes('pdf') ? 'document' : d.mimeType?.includes('image') ? 'design' : 'spreadsheet',
    status: d.fileCategory,
    date: format(new Date(d.createdAt), 'MMM d'),
  }));

  // Combine messages and activity logs
  const rawActivities = [
    ...client.messages.map(m => ({ id: m.id, user: m.authorName, action: 'posted a message', target: '', time: m.createdAt, isMessage: true })),
    ...client.activityLogs.map(a => ({ id: a.id, user: 'System', action: a.action, target: '', time: a.createdAt, isMessage: false }))
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 20);

  const activityFeed = rawActivities.map(a => ({
    id: a.id,
    user: a.user,
    action: a.action,
    target: a.target,
    time: formatDistanceToNow(new Date(a.time), { addSuffix: true })
  }));

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px' }}>
        
        {/* Breadcrumb & Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <Link href="/rn/projects" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Projects</Link>
            <span>/</span>
            <span>{project.client}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="rn-title-xl">{project.name}</h1>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                <span className="rn-badge success">On Track</span>
                <span className="rn-subtitle">Due: {project.deadline}</span>
                <span className="rn-subtitle">Budget: {project.budget}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <AdvanceStageButton 
                projectId={project.id} 
                currentStage={client.currentStage} 
                allStages={Array.isArray(client.serviceModule.workflowStages) ? client.serviceModule.workflowStages as string[] : []} 
              />
              <UploadDeliverableButton projectId={project.id} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: 32 }}>
          
          {/* Main Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* Timeline View */}
            <div className="rn-panel">
              <div className="rn-panel-header">
                <h2 className="rn-panel-title">Milestone Tracker</h2>
              </div>
              <div className="rn-panel-body" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 40, left: 40, right: 40, height: 2, background: 'var(--surface-3)', zIndex: 0 }} />
                
                {milestones.map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 12, flex: 1 }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 16, 
                      background: m.status === 'completed' ? 'var(--success)' : m.status === 'active' ? 'var(--brand)' : 'var(--obsidian)',
                      border: `2px solid ${m.status === 'upcoming' ? 'var(--surface-3)' : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: m.status === 'active' ? '0 0 0 4px var(--brand-light)' : 'none'
                    }}>
                      {m.status === 'completed' && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                      {m.status === 'active' && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: m.status === 'upcoming' ? 'var(--text-secondary)' : '#fff' }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverables Board */}
            <div className="rn-panel">
              <div className="rn-panel-header">
                <h2 className="rn-panel-title">Active Deliverables</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6 }}>All</button>
                  <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, background: 'var(--surface-3)' }}>Needs Review</button>
                </div>
              </div>
              <div className="rn-panel-body" style={{ padding: 0 }}>
                {deliverables.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                        {d.type === 'document' ? '📄' : d.type === 'design' ? '🎨' : '📊'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{d.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Updated {d.date}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <span className={`rn-badge ${d.status === 'approved' ? 'success' : d.status === 'client-review' ? 'warning' : 'neutral'}`}>
                        {d.status.replace('-', ' ')}
                      </span>
                      <button className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Activity & Comms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="rn-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="rn-panel-header">
                <h2 className="rn-panel-title">Workspace Activity</h2>
              </div>
              <div className="rn-panel-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {activityFeed.map((activity) => (
                  <div key={activity.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--surface-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                      {activity.user.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{activity.user}</span> {activity.action} <span style={{ color: 'var(--brand)' }}>{activity.target}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{activity.time}</div>
                    </div>
                  </div>
                ))}

              </div>
              <MessageInput projectId={project.id} />
            </div>
          </div>

        </div>
      </main>
    </RippleNexusShell>
  );
}
