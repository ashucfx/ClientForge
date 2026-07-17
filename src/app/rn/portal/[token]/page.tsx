// src/app/rn/portal/[token]/page.tsx — Premium Client Overview
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import PayNowButton from './PayNowButton';

export const dynamic = 'force-dynamic';

function getFileIconSvg(ext: string): React.ReactNode {
  switch (ext) {
    case 'pdf': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;
    case 'doc':
    case 'docx': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
    case 'xls':
    case 'xlsx': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
    case 'ppt':
    case 'pptx': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>;
    case 'zip':
    case 'rar': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>;
    case 'mp4': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ec4899" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>;
    case 'mp3': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#14b8a6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>;
    case 'png':
    case 'jpg':
    case 'jpeg': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#06b6d4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
    case 'svg':
    case 'fig':
    case 'ai':
    case 'psd': return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#f43f5e" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>;
    default: return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>;
  }
}
function fileIcon(name: string): React.ReactNode {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return getFileIconSvg(ext);
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
          <span style={{ display: 'inline-flex', color: '#22D3EE', marginRight: 12 }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
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
        <span className={`portal-status ${waitingOnLabel.cls}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {waitingOnLabel.cls === 'waiting' ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : waitingOnLabel.cls === 'on-us' ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          )}
          {waitingOnLabel.text}
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
            <h2 className="portal-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: '#B794FF' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Recent Deliverables
            </h2>
            <Link href={`/rn/portal/${params.token}/deliverables`} style={{ fontSize: 12, color: '#B794FF', textDecoration: 'none', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div className="portal-card-body">
            {client.deliverables.length === 0 ? (
              <div className="portal-empty">
                <div className="portal-empty-icon" style={{ display: 'flex', justifyContent: 'center', color: '#6B7394', marginBottom: 12 }}>
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                  </svg>
                </div>
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
            <h2 className="portal-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: '#B794FF' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Project Milestones
            </h2>
            <Link href={`/rn/portal/${params.token}/milestones`} style={{ fontSize: 12, color: '#B794FF', textDecoration: 'none', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div className="portal-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {client.milestones.length === 0 ? (
              <div className="portal-empty">
                <div className="portal-empty-icon" style={{ display: 'flex', justifyContent: 'center', color: '#6B7394', marginBottom: 12 }}>
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
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
          { icon: <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, label: 'Revisions', value: client.revisions.length, desc: 'revision requests made' },
          { icon: <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>, label: 'Deliverables', value: client.deliverables.length, desc: 'files shared' },
          { icon: <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, label: 'Milestones done', value: `${client.milestones.filter(m => (['COMPLETED', 'APPROVED'] as string[]).includes(m.status)).length} / ${client.milestones.length}`, desc: 'completed' },
        ].map((stat, i) => (
          <div key={i} className="portal-card" style={{ padding: '20px 22px' }}>
            <div style={{ color: '#B794FF', marginBottom: 10, display: 'inline-flex' }}>{stat.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F4F5FA', marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#6B7394' }}>{stat.desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
