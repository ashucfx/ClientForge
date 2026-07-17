// src/app/rn/portal/[token]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PortalDashboardPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: {
      serviceModule: true,
      milestones: { orderBy: { dueDate: 'asc' } },
      deliverables: { orderBy: { createdAt: 'desc' }, take: 4 },
      revisions: { orderBy: { createdAt: 'desc' }, take: 4 },
    },
  });
  if (!client) notFound();

  const pendingInvoices = await prisma.invoice.findMany({
    where: { clientEmail: client.email, brandId: 'ripple_nexus', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  const workflowStages = Array.isArray(client.serviceModule.workflowStages)
    ? (client.serviceModule.workflowStages as string[]) : [];
  const completedStages = Array.isArray(client.completedStages)
    ? (client.completedStages as string[]) : [];
  const progress = workflowStages.length > 0
    ? Math.round((completedStages.length / workflowStages.length) * 100) : 0;

  const currentIdx = workflowStages.indexOf(client.currentStage);
  const nextMilestone = client.milestones.find(m => !['COMPLETED', 'APPROVED'].includes(m.status));
  const unpaidMilestones = client.milestones.filter(m => m.paymentStatus === 'REQUESTED' || m.paymentStatus === 'UNPAID');
  const outstandingAmount = unpaidMilestones.reduce((acc, m) => acc + (m.amount || 0), 0);

  const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
  const currencySymbol = CURRENCY_SYMBOLS[client.currency] || client.currency + ' ';

  return (
    <div className="portal-dashboard">
      <div className="dashboard-header-block">
        <div className="header-greeting">
          <h1>Welcome back, {client.name.split(' ')[0]}</h1>
          <p>Here is the current status of your {client.serviceModule.name} project.</p>
        </div>
        <div className="header-actions">
          {pendingInvoices.length > 0 && (
            <Link href={`/rn/portal/${params.token}/invoices`} className="btn-premium alert-btn">
              Pay {currencySymbol}{pendingInvoices.reduce((acc, i) => acc + (i.totalPayable||0), 0).toLocaleString()} Due
            </Link>
          )}
          {outstandingAmount > 0 && pendingInvoices.length === 0 && (
            <Link href={`/rn/portal/${params.token}/milestones`} className="btn-premium alert-btn">
              {currencySymbol}{outstandingAmount.toLocaleString()} Outstanding
            </Link>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-label">Overall Progress</div>
          <div className="metric-value">{progress}%</div>
          <div className="progress-bar-bg mt-4">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-label">Current Phase</div>
          <div className="metric-value" style={{ fontSize: '24px' }}>
            {client.currentStage.replace(/_/g, ' ')}
          </div>
          <div className="metric-subtext mt-4">
            Step {currentIdx + 1} of {workflowStages.length}
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-label">Next Milestone</div>
          <div className="metric-value truncate-text" style={{ fontSize: '20px' }} title={nextMilestone?.title ?? 'Completed'}>
            {nextMilestone?.title ?? 'All Milestones Completed'}
          </div>
          <div className="metric-subtext mt-4">
            {nextMilestone?.dueDate ? `${differenceInCalendarDays(new Date(nextMilestone.dueDate), new Date())} days remaining` : 'No upcoming deadline'}
          </div>
        </div>
      </div>

      <div className="dashboard-split mt-8">
        <div className="dashboard-column main-col">
          {/* Workflow Journey */}
          <div className="panel glass-panel">
            <div className="panel-header">
              <h2>Project Journey</h2>
            </div>
            <div className="journey-track">
              {workflowStages.map((stage, i) => {
                const isCompleted = completedStages.includes(stage);
                const isCurrent = stage === client.currentStage;
                const statusClass = isCompleted ? 'done' : isCurrent ? 'active' : 'pending';
                return (
                  <div key={stage} className={`journey-node ${statusClass}`}>
                    <div className="node-indicator">
                      {isCompleted ? (
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      ) : isCurrent ? (
                        <div className="pulse-dot"/>
                      ) : (
                        <div className="empty-dot"/>
                      )}
                    </div>
                    <div className="node-content">
                      <div className="node-title">{stage.replace(/_/g, ' ')}</div>
                      {isCurrent && <div className="node-desc">We are actively working on this phase.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dashboard-column side-col">
          {/* Recent Deliverables */}
          <div className="panel glass-panel">
            <div className="panel-header flex-between">
              <h2>Recent Deliverables</h2>
              <Link href={`/rn/portal/${params.token}/deliverables`} className="link-subtle">View all</Link>
            </div>
            {client.deliverables.length === 0 ? (
              <div className="empty-state-mini">No deliverables uploaded yet.</div>
            ) : (
              <div className="feed-list">
                {client.deliverables.map(doc => (
                  <div key={doc.id} className="feed-item">
                    <div className="feed-icon blue"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg></div>
                    <div className="feed-info">
                      <div className="feed-title">{doc.label || doc.originalName}</div>
                      <div className="feed-meta">{doc.approvalStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions / Need Help */}
          <div className="panel panel-dark mt-6">
            <div className="panel-header"><h2>Need Assistance?</h2></div>
            <p className="text-sm opacity-80 mb-4">Message your project manager directly for updates or feedback.</p>
            <Link href={`/rn/portal/${params.token}/messages`} className="btn-outline-white w-full text-center block">
              Open Messages
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
