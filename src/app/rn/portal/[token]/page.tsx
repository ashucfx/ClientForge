// src/app/rn/portal/[token]/page.tsx — Premium Client Overview
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import PayNowButton from './PayNowButton';

export const dynamic = 'force-dynamic';

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📊', pptx: '📊', zip: '📦', rar: '📦', mp4: '🎬',
  mp3: '🎵', png: '🖼', jpg: '🖼', jpeg: '🖼', svg: '🎨',
  fig: '🎨', ai: '🎨', psd: '🎨',
};
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? '📎';
}

type MilestoneStatus = 'COMPLETED' | 'APPROVED' | string;

export default async function PortalOverviewPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: {
      serviceModule: true,
      milestones: { orderBy: { dueDate: 'asc' }, take: 6 },
      deliverables: { orderBy: { createdAt: 'desc' }, take: 6 },
      revisions: { orderBy: { createdAt: 'desc' }, take: 3 }, // createdAt, not requestedAt
    },
  });
  if (!client) notFound();

  // RN invoices use clientEmail + brandId to link — NOT InvoiceClientLink (Catalyst only)
  const pendingInvoices = await prisma.invoice.findMany({
    where: { clientEmail: client.email, brandId: 'ripple_nexus', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  // Upcoming agency holidays — isGuested was added to schema, use it
  const upcomingHolidays = await prisma.rnHoliday.findMany({
    where: { date: { gte: new Date() }, isGuested: true },
    orderBy: { date: 'asc' },
    take: 2,
  });

  // Project progress
  const workflowStages = Array.isArray(client.serviceModule.workflowStages)
    ? (client.serviceModule.workflowStages as string[])
    : [];
  const completedStages = Array.isArray(client.completedStages)
    ? (client.completedStages as string[])
    : [];
  const progress = workflowStages.length > 0
    ? Math.round((completedStages.length / workflowStages.length) * 100)
    : 0;
  const currentIdx = workflowStages.indexOf(client.currentStage);

  // Upcoming milestone
  const nextMilestone = client.milestones.find(
    (m) => !(['COMPLETED', 'APPROVED'] as MilestoneStatus[]).includes(m.status)
  );
  const daysToDelivery = client.expectedDeliveryAt
    ? differenceInCalendarDays(new Date(client.expectedDeliveryAt), new Date())
    : null;

  const waitingOnLabel = client.waitingOn === 'CLIENT'
    ? { text: 'Waiting on you', cls: 'waiting' }
    : client.waitingOn === 'AGENCY'
    ? { text: "We're working on it", cls: 'on-us' }
    : { text: 'On track', cls: 'done' };

  const deliveryDone = (client.completedAt !== null);

  return (
    <>
      {/* Holiday notice */}
      {upcomingHolidays[0] && differenceInCalendarDays(new Date(upcomingHolidays[0].date), new Date()) <= 7 && (
        <div className="portal-holiday-notice">
          <span style={{ fontSize: 20 }}>🗓</span>
          <div>
            <strong style={{ color: '#22D3EE' }}>Upcoming agency closure — </strong>
            {upcomingHolidays[0].name} on {format(new Date(upcomingHolidays[0].date), 'EEEE, MMMM d')}.
            Deliveries around this date may shift by one working day.
          </div>
        </div>
      )}

      {/* Hero section */}
      <div className="portal-hero" style={{ marginBottom: 24 }}>
        <div className="portal-hero-label">Project Status</div>
        <h1 className="portal-hero-title">{client.serviceModule.name}</h1>
        <p className="portal-hero-sub">
          {client.companyName ? `${client.companyName} · ` : ''}
          {client.currentStage.replace(/_/g, ' ')} phase
          {daysToDelivery !== null && !deliveryDone && (
            <> · <span style={{ color: daysToDelivery <= 7 ? '#FBBF24' : '#A3E635', fontWeight: 700 }}>
              {daysToDelivery <= 0 ? 'Delivery today' : `${daysToDelivery} days to delivery`}
            </span></>
          )}
          {deliveryDone && (
            <> · <span style={{ color: '#10B981', fontWeight: 700 }}>✓ Delivered</span></>
          )}
        </p>

        <div className="portal-progress-wrap">
          <div className="portal-progress-labels">
            <span style={{ fontSize: 13, color: '#C6CBDD' }}>Overall progress</span>
            <span className="portal-progress-pct">{progress}%</span>
          </div>
          <div className="portal-progress-track">
            <div className="portal-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {workflowStages.length > 0 && (
          <div className="portal-stage-row">
            {workflowStages.map((stage, i) => {
              const done = completedStages.includes(stage);
              const current = i === currentIdx;
              return (
                <span
                  key={stage}
                  className={`portal-stage-pill ${done ? 'done' : current ? 'current' : 'pending'}`}
                >
                  {done ? '✓ ' : current ? '◉ ' : '○ '}
                  {stage.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`portal-status ${waitingOnLabel.cls}`}>
          {waitingOnLabel.cls === 'waiting' ? '⏳' : waitingOnLabel.cls === 'on-us' ? '⚡' : '✓'}
          {' '}{waitingOnLabel.text}
        </span>
        {nextMilestone && (
          <span style={{ fontSize: 13, color: '#C6CBDD' }}>
            Next milestone: <strong style={{ color: '#F4F5FA' }}>{nextMilestone.title}</strong>
            {nextMilestone.dueDate && <> · {format(new Date(nextMilestone.dueDate), 'MMM d')}</>}
          </span>
        )}
      </div>

      {/* Pending invoices — payment CTAs */}
      {pendingInvoices.length > 0 && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingInvoices.map(inv => (
            <div key={inv.id} className="portal-payment-card">
              <div>
                <div style={{ fontSize: 13, color: '#B794FF', fontWeight: 700, marginBottom: 6 }}>
                  Invoice #{inv.invoiceNumber}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#F4F5FA', marginBottom: 4 }}>
                  {inv.currency} {Number(inv.totalPayable).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: '#6B7394' }}>
                  Due {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                </div>
              </div>
              <PayNowButton invoiceId={inv.id} gateway={inv.paymentGateway ?? 'RAZORPAY'} />
            </div>
          ))}
        </div>
      )}

      {/* 2-column grid */}
      <div className="portal-grid-2" style={{ marginBottom: 24 }}>
        {/* Recent deliverables */}
        <div className="portal-card portal-card-hover">
          <div className="portal-card-header">
            <h2 className="portal-card-title">📦 Recent Deliverables</h2>
            <Link href={`/rn/portal/${params.token}/deliverables`} style={{ fontSize: 12, color: '#B794FF', textDecoration: 'none', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div className="portal-card-body">
            {client.deliverables.length === 0 ? (
              <div className="portal-empty">
                <div className="portal-empty-icon">📭</div>
                <p className="portal-empty-title">No deliverables yet</p>
                <p className="portal-empty-desc">Files and assets shared by the team will appear here.</p>
              </div>
            ) : client.deliverables.map(d => (
              <div key={d.id} className="portal-deliverable-item">
                <div className="portal-deliverable-icon">{fileIcon(d.label)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="portal-deliverable-name">{d.label}</div>
                  <div className="portal-deliverable-date">{format(new Date(d.createdAt), 'MMM d, yyyy')}</div>
                </div>
                {d.approvalStatus && (
                  <span style={{
                    flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 9999,
                    background: d.approvalStatus === 'APPROVED' ? 'rgba(16,185,129,0.12)' : d.approvalStatus === 'PENDING' ? 'rgba(251,191,36,0.12)' : 'rgba(124,92,255,0.12)',
                    color: d.approvalStatus === 'APPROVED' ? '#10B981' : d.approvalStatus === 'PENDING' ? '#FBBF24' : '#B794FF',
                  }}>
                    {d.approvalStatus}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div className="portal-card portal-card-hover">
          <div className="portal-card-header">
            <h2 className="portal-card-title">🎯 Project Milestones</h2>
            <Link href={`/rn/portal/${params.token}/milestones`} style={{ fontSize: 12, color: '#B794FF', textDecoration: 'none', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div className="portal-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {client.milestones.length === 0 ? (
              <div className="portal-empty">
                <div className="portal-empty-icon">🗺</div>
                <p className="portal-empty-title">Milestones coming soon</p>
                <p className="portal-empty-desc">Your project roadmap will be outlined here.</p>
              </div>
            ) : client.milestones.map((m, i) => {
              const done = (['COMPLETED', 'APPROVED'] as string[]).includes(m.status);
              const overdue = !done && m.dueDate && new Date(m.dueDate) < new Date();
              return (
                <div key={m.id} className="portal-milestone-step">
                  <div className="portal-milestone-dot" style={{
                    background: done ? 'rgba(16,185,129,0.15)' : overdue ? 'rgba(244,63,94,0.15)' : 'rgba(124,92,255,0.15)',
                    color: done ? '#10B981' : overdue ? '#F43F5E' : '#B794FF',
                    border: `2px solid ${done ? '#10B981' : overdue ? '#F43F5E' : '#7C5CFF'}`,
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#F4F5FA', marginBottom: 3 }}>{m.title}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {m.dueDate && (
                        <span style={{ fontSize: 12, color: overdue ? '#F43F5E' : '#6B7394', fontWeight: 500 }}>
                          {format(new Date(m.dueDate), 'MMM d, yyyy')}
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 9999, background: done ? 'rgba(16,185,129,0.1)' : overdue ? 'rgba(244,63,94,0.1)' : 'rgba(124,92,255,0.1)', color: done ? '#10B981' : overdue ? '#F43F5E' : '#B794FF', fontWeight: 600 }}>
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {m.description && <div style={{ fontSize: 12, color: '#6B7394', marginTop: 4, lineHeight: 1.5 }}>{m.description}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="portal-grid-3">
        {[
          { icon: '📋', label: 'Revisions', value: client.revisions.length, desc: 'revision requests made' },
          { icon: '📎', label: 'Deliverables', value: client.deliverables.length, desc: 'files shared' },
          { icon: '🎯', label: 'Milestones done', value: `${client.milestones.filter(m => (['COMPLETED', 'APPROVED'] as string[]).includes(m.status)).length} / ${client.milestones.length}`, desc: 'completed' },
        ].map((stat, i) => (
          <div key={i} className="portal-card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>{stat.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F4F5FA', marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#6B7394' }}>{stat.desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
