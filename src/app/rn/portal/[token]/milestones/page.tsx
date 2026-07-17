// src/app/rn/portal/[token]/milestones/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PortalMilestonesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: {
      milestones: { orderBy: { order: 'asc' } },
    }
  });
  if (!client) notFound();

  return (
    <div className="portal-milestones">
      <div className="dashboard-header-block">
        <div className="header-greeting">
          <h1>Project Timeline</h1>
          <p>Track the detailed progress of your project milestones.</p>
        </div>
      </div>

      <div className="panel glass-panel mt-8">
        <div className="journey-track" style={{ padding: '24px' }}>
          {client.milestones.length === 0 ? (
            <div className="empty-state-mini">No milestones have been defined yet.</div>
          ) : (
            client.milestones.map((milestone, idx) => {
              const isCompleted = milestone.status === 'COMPLETED' || milestone.status === 'APPROVED';
              const isCurrent = milestone.status === 'IN_PROGRESS' || milestone.status === 'IN_REVIEW';
              const statusClass = isCompleted ? 'done' : isCurrent ? 'active' : 'pending';
              
              return (
                <div key={milestone.id} className={`journey-node ${statusClass}`}>
                  <div className="node-indicator" style={{ marginTop: '4px' }}>
                    {isCompleted ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : isCurrent ? (
                      <div className="pulse-dot" style={{ width: 16, height: 16 }}/>
                    ) : (
                      <div className="empty-dot" style={{ width: 16, height: 16 }}/>
                    )}
                  </div>
                  
                  <div className="node-content" style={{ width: '100%', paddingBottom: '32px' }}>
                    <div className="flex-between">
                      <div className="node-title" style={{ fontSize: '18px' }}>{idx + 1}. {milestone.title}</div>
                      {milestone.dueDate && (
                        <div className="node-desc" style={{ marginTop: 0 }}>
                          {isCompleted && milestone.completedAt 
                            ? `Completed ${format(new Date(milestone.completedAt), 'MMM d, yyyy')}` 
                            : `Due ${format(new Date(milestone.dueDate), 'MMM d, yyyy')}`}
                        </div>
                      )}
                    </div>
                    
                    {milestone.description && (
                      <div className="node-desc mt-4" style={{ lineHeight: 1.6, maxWidth: '800px' }}>
                        {milestone.description}
                      </div>
                    )}
                    
                    {(milestone.paymentStatus === 'REQUESTED' || milestone.paymentStatus === 'UNPAID') && milestone.amount > 0 && (
                      <div className="mt-4" style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: 'var(--rn-danger)' }}>Payment Required:</strong> ${milestone.amount.toLocaleString()}
                        </div>
                        {milestone.invoiceId ? (
                          milestone.invoiceId.includes('rzp.io') ? (
                            <a href={milestone.invoiceId} target="_blank" className="btn-premium alert-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>Pay via Razorpay</a>
                          ) : (
                            <Link href={`/rn/invoices/${milestone.invoiceId}`} className="btn-premium alert-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>View Invoice</Link>
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
