import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { IconCheck, IconSettings, IconDocument } from '@/components/Icons';
import { RnClientFeedbackForms } from '@/components/rn/RnClientFeedbackForms';

export const dynamic = 'force-dynamic';

export default async function RnPortalOverviewPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: { serviceModule: true, Feedback: true, Review: true }
  });

  if (!client) notFound();

  const [invoice, recentDeliverables] = await Promise.all([
    client.invoiceId ? prisma.invoice.findUnique({ where: { id: client.invoiceId } }) : Promise.resolve(null),
    prisma.rnDeliverable.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const stages = (client.serviceModule?.workflowStages as string[]) || ['NOT_STARTED', 'IN_PROGRESS', 'DELIVERED'];
  const currentStageIndex = stages.indexOf(client.currentStage);
  const completedCount = Array.isArray(client.completedStages) ? client.completedStages.length : 0;
  const progressPct = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
      
      {/* Welcome Hero */}
      <div style={{ gridColumn: '1 / -1', marginBottom: 16 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12, background: 'linear-gradient(135deg, #F4F5FA 0%, #A1A1AA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Overview
        </h1>
        <p style={{ fontSize: 16, color: '#A1A1AA', maxWidth: 600, lineHeight: 1.6 }}>
          Track your {client.serviceModule.name} project progress, view billing history, and access recent deliverables.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 420, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(135deg, #7C5CFF 0%, #B794FF 55%, #22D3EE 100%)' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#A3E635' }}>{progressPct}% complete</span>
          {client.expectedDeliveryAt && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA' }}>
              Target delivery: {format(new Date(client.expectedDeliveryAt), 'MMM dd, yyyy')}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: client.waitingOn === 'CLIENT' ? 'rgba(251,191,36,0.14)' : 'rgba(124,92,255,0.14)', color: client.waitingOn === 'CLIENT' ? '#FBBF24' : '#B794FF' }}>
            {client.waitingOn === 'CLIENT' ? 'Waiting on you' : 'We’re on it'}
          </span>
        </div>
      </div>

      {client.currentStage === 'DELIVERED' && (!client.Feedback || !client.Review) && (
        <RnClientFeedbackForms 
          hasSubmittedFeedback={!!client.Feedback} 
          hasSubmittedReview={!!client.Review} 
          serviceName={client.serviceModule.name} 
        />
      )}

      {/* Project Timeline */}
      <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSettings size={20} style={{ color: '#7C5CFF' }} /> Project Pipeline
        </h2>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', paddingBottom: 16 }}>
          {/* Connecting Line */}
          <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />
          
          {stages.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;
            const isPending = currentStageIndex < idx;
            
            return (
              <div key={stage} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                <div style={{ 
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCompleted ? '#22c55e' : (isCurrent ? 'linear-gradient(135deg, #7C5CFF, #22D3EE)' : '#18181b'),
                  border: `2px solid ${isPending ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
                  color: '#fff', fontSize: 14, fontWeight: 800, marginBottom: 12
                }}>
                  {isCompleted ? <IconCheck size={16} /> : (idx + 1)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isPending ? '#A1A1AA' : '#F4F5FA', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {stage.replace(/_/g, ' ')}
                </div>
                {isCurrent && (
                  <div style={{ fontSize: 10, color: '#22D3EE', fontWeight: 600, marginTop: 4 }}>CURRENT PHASE</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing & Invoices */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: '#F4F5FA' }}>Billing &amp; Payments</h2>
        {invoice ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F4F5FA', marginBottom: 4 }}>{invoice.invoiceNumber}</div>
              <div style={{ fontSize: 11, color: '#A1A1AA' }}>{format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                {invoice.currencySymbol}{invoice.totalPayable.toLocaleString()}
              </div>
              {invoice.status === 'PAID' ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4 }}>PAID</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: 4 }}>{invoice.status}</span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#A1A1AA' }}>No invoices found.</div>
        )}
      </div>

      {/* Recent Activity / Deliverables Placeholder */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: '#F4F5FA', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconDocument size={18} style={{ color: '#22D3EE' }} /> Recent Deliverables
        </h2>
        <div style={{ fontSize: 13, color: '#A1A1AA', padding: 20, textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
          Head over to the Deliverables tab to view and approve your project assets.
        </div>
      </div>

    </div>
  );
}
