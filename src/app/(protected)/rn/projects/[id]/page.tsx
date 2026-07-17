// src/app/(protected)/rn/projects/[id]/page.tsx — Project Cockpit
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { formatDistanceToNow, format, differenceInCalendarDays } from 'date-fns';
import {
  MessageInput, AdvanceStageButton, UploadDeliverableButton,
  EditProjectButton, ArchiveProjectButton, DeliverableAdminActions,
} from '@/components/rn/ProjectMutations';
import { PortalLinkActions } from '@/components/rn/PortalLinkActions';
import { DeleteClientButton } from '@/components/rn/DeleteClientButton';
import { AdminMessenger } from '@/components/rn/AdminMessenger';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };

function approvalBadge(status: string) {
  switch (status) {
    case 'APPROVED':          return <span className="rn-badge success">Approved</span>;
    case 'CHANGES_REQUESTED': return <span className="rn-badge warning">Changes Requested</span>;
    default:                  return <span className="rn-badge neutral">Pending Review</span>;
  }
}

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
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      revisions: { orderBy: { createdAt: 'desc' }, take: 5 },
      ConversationReadState: true,
    },
  });

  if (!client) {
    redirect('/rn/projects');
  }

  const isCompleted = client.currentStage === 'COMPLETED';
  const overdueDays = client.expectedDeliveryAt && !isCompleted
    ? differenceInCalendarDays(new Date(), new Date(client.expectedDeliveryAt))
    : 0;
  const isOverdue = overdueDays > 0;
  const slaDeadline = client.ConversationReadState?.adminSlaDeadline
    ? new Date(client.ConversationReadState.adminSlaDeadline)
    : null;
  const slaBreached = !!(slaDeadline && slaDeadline.getTime() < Date.now());

  const sym = CURRENCY_SYMBOLS[client.currency] ?? `${client.currency} `;
  const project = {
    id: client.id,
    name: client.serviceModule.name,
    client: client.companyName || client.name,
    deadline: client.expectedDeliveryAt ? format(new Date(client.expectedDeliveryAt), 'MMM d, yyyy') : 'TBD',
    budget: `${sym}${Math.round(client.amountPaid).toLocaleString()}`,
  };

  const completedArr = Array.isArray(client.completedStages) ? client.completedStages : [];
  const milestones = (Array.isArray(client.serviceModule.workflowStages) ? client.serviceModule.workflowStages : []).map((stage: any, i) => {
    let mStatus = 'upcoming';
    if (completedArr.includes(stage)) mStatus = 'completed';
    else if (stage === client.currentStage) mStatus = 'active';
    return {
      id: `m_${i}`,
      title: typeof stage === 'string' ? stage.replace(/_/g, ' ') : stage,
      status: mStatus,
      date: mStatus === 'completed' ? 'Done' : mStatus === 'active' ? 'Current' : 'Pending',
    };
  });

  const rawActivities = [
    ...client.messages.map(m => ({ id: m.id, user: m.authorName, action: m.isInternalOnly ? 'added an internal note' : 'posted a message', detail: m.content.slice(0, 90), time: m.createdAt, internal: m.isInternalOnly })),
    ...client.activityLogs.map(a => ({ id: a.id, user: a.performedBy === 'Admin' ? 'Team' : a.performedBy, action: a.action, detail: '', time: a.createdAt, internal: false })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 20);

  return (
    <RippleNexusShell>
      <main className="rn-page">

        {/* Breadcrumb & Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <Link href="/rn/projects" style={{ color: 'var(--plasma)', textDecoration: 'none' }}>Projects</Link>
            <span>/</span>
            <span>{project.client}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="rn-title-xl">{project.name}</h1>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {isCompleted
                  ? <span className="rn-badge cyan">Completed</span>
                  : isOverdue
                    ? <span className="rn-badge danger">Overdue</span>
                    : <span className="rn-badge success">On Track</span>}
                {client.lifecycleStatus !== 'ACTIVE' && <span className="rn-badge neutral">{client.lifecycleStatus}</span>}
                <span className="rn-subtitle">Due: {project.deadline}</span>
                <span className="rn-subtitle">Budget: <span className="rn-proof">{project.budget}</span></span>
                <span className="rn-subtitle">Waiting on: {client.waitingOn === 'CLIENT' ? 'Client' : 'Agency'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <EditProjectButton
                projectId={project.id}
                expectedDeliveryAt={client.expectedDeliveryAt?.toISOString() ?? null}
                amountPaid={client.amountPaid}
                notes={client.notes}
                companyName={client.companyName}
                clientName={client.name}
                email={client.email}
              />
              <AdvanceStageButton
                projectId={project.id}
                currentStage={client.currentStage}
                allStages={Array.isArray(client.serviceModule.workflowStages) ? client.serviceModule.workflowStages as string[] : []}
              />
              <UploadDeliverableButton projectId={project.id} />
              <ArchiveProjectButton projectId={project.id} lifecycleStatus={client.lifecycleStatus} />
              <DeleteClientButton clientId={project.id} clientLabel={project.client} />
            </div>
          </div>

          {/* Alert banners */}
          {isOverdue && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
              ⚠ This project is {overdueDays} day{overdueDays === 1 ? '' : 's'} past its expected delivery date.
            </div>
          )}
          {slaBreached && (
            <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
              ⏱ Response SLA breached — the client is waiting on a reply.
            </div>
          )}

          {/* Portal + notes strip */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Client Portal</span>
            <PortalLinkActions clientId={project.id} />
          </div>
          {client.notes && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Internal Notes</span>
              {client.notes}
            </div>
          )}
        </div>

        <div className="rn-dash-grid">

          {/* Main Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

            {/* Timeline View */}
            <div className="rn-panel">
              <div className="rn-panel-header">
                <h2 className="rn-panel-title">Milestone Tracker</h2>
                <Link href={`/rn/projects/${project.id}/milestones`} style={{ fontSize: 12, color: 'var(--plasma)', textDecoration: 'none', fontWeight: 600 }}>
                  Detail view →
                </Link>
              </div>
              <div className="rn-panel-body table-scroll-wrapper" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', minWidth: 0 }}>
                <div style={{ position: 'absolute', top: 40, left: 40, right: 40, height: 2, background: 'var(--surface-3)', zIndex: 0 }} />
                {milestones.map((m) => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 12, flex: 1, minWidth: 90 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      background: m.status === 'completed' ? 'var(--success)' : m.status === 'active' ? 'var(--brand)' : 'var(--surface-3)',
                      border: `2px solid ${m.status === 'upcoming' ? 'var(--border)' : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: m.status === 'active' ? '0 0 0 4px var(--brand-light)' : 'none'
                    }}>
                      {m.status === 'completed' && <span style={{ color: '#0A0B14', fontSize: 12, fontWeight: 800 }}>✓</span>}
                      {m.status === 'active' && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#0A0B14' }} />}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: m.status === 'upcoming' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverables Board */}
            <div className="rn-panel">
              <div className="rn-panel-header">
                <h2 className="rn-panel-title">Deliverables</h2>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {client.deliverables.filter(d => d.approvalStatus === 'APPROVED').length}/{client.deliverables.length} approved
                </span>
              </div>
              <div className="rn-panel-body" style={{ padding: 0 }}>
                {client.deliverables.length === 0 && (
                  <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No deliverables yet — upload the first file for client review.
                  </div>
                )}
                {client.deliverables.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {d.mimeType?.includes('pdf') ? '📄' : d.mimeType?.includes('image') ? '🎨' : '📦'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflowWrap: 'anywhere' }}>{d.originalName || d.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {format(new Date(d.createdAt), 'MMM d, yyyy')}
                          {d.sizeBytes > 0 && <> · {(d.sizeBytes / 1024 / 1024).toFixed(2)} MB</>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {approvalBadge(d.approvalStatus)}
                      <DeliverableAdminActions deliverableId={d.id} approvalStatus={d.approvalStatus} fileUrl={d.fileUrl} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revision requests */}
            {client.revisions.length > 0 && (
              <div className="rn-panel">
                <div className="rn-panel-header">
                  <h2 className="rn-panel-title">Revision Requests</h2>
                </div>
                <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {client.revisions.map(r => (
                    <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span className="rn-badge warning" style={{ flexShrink: 0 }}>Revision</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{r.note}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                          {r.fileLabel && <>{r.fileLabel} · </>}{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })} · by {r.requestedBy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Activity & Comms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0, height: '700px' }}>
            <AdminMessenger clientId={project.id} adminName={session.adminId === 'admin_1' ? 'Ripple Nexus Team' : 'Project Manager'} />
          </div>

        </div>
      </main>
    </RippleNexusShell>
  );
}
