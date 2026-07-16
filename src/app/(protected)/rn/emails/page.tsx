// src/app/(protected)/rn/emails/page.tsx — Email Center
// Every Ripple Nexus email (automatic flow or manual) with delivery status,
// plus 30-day analytics and manual compose.
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { EmailComposer } from '@/components/rn/EmailComposer';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { isRnSmtpConfigured } from '@/lib/rn/mailer';

export const dynamic = 'force-dynamic';

const TRIGGER_LABELS: Record<string, string> = {
  welcome: 'Welcome / Portal Invite',
  otp: 'Login PIN',
  admin_message: 'New Message',
  stage_advanced: 'Stage Advanced',
  deliverable_uploaded: 'Deliverable Ready',
  milestone_payment_request: 'Payment Request',
  milestone_completed: 'Milestone Completed',
  manual: 'Manual',
};

export default async function RnEmailsPage({ searchParams }: { searchParams: { status?: string; trigger?: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const statusFilter = searchParams.status ?? '';
  const triggerFilter = searchParams.trigger ?? '';
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [logs, clients, sent30, failed30, byTrigger] = await Promise.all([
    prisma.rnEmailLog.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(triggerFilter ? { trigger: triggerFilter } : {}),
      },
      include: { client: { select: { id: true, name: true, companyName: true, email: true } } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    }),
    prisma.rnClient.findMany({
      where: { lifecycleStatus: 'ACTIVE' },
      select: { id: true, name: true, companyName: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.rnEmailLog.count({ where: { status: 'sent', sentAt: { gte: thirtyDaysAgo } } }),
    prisma.rnEmailLog.count({ where: { status: 'failed', sentAt: { gte: thirtyDaysAgo } } }),
    prisma.rnEmailLog.groupBy({
      by: ['trigger'],
      where: { sentAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  const smtpReady = isRnSmtpConfigured();
  const triggerStats = byTrigger.sort((a, b) => b._count._all - a._count._all).slice(0, 6);
  const maxTrigger = Math.max(1, ...triggerStats.map(t => t._count._all));
  const composerClients = clients.map(c => ({ id: c.id, label: `${c.companyName || c.name} <${c.email}>` }));

  const chip = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={`rn-chip${active ? ' active' : ''}`}>{label}</Link>
  );

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Communications</div>
            <h1 className="rn-title-xl">Email Center</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              Every client email — automatic flows and manual sends — with delivery status.
            </p>
          </div>
          <EmailComposer clients={composerClients} />
        </header>

        {!smtpReady && (
          <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'var(--warning-bg)', border: '1px solid var(--warning)', fontSize: 13, color: 'var(--warning)' }}>
            <strong>SMTP not configured.</strong> Set <code>RN_SMTP_HOST</code>, <code>RN_SMTP_USER</code>, <code>RN_SMTP_PASS</code>
            {' '}(optional <code>RN_SMTP_PORT</code>, <code>RN_SMTP_FROM</code>) in the environment. Until then, Ripple Nexus emails fall back to Resend.
          </div>
        )}

        {/* 30-day analytics */}
        <div className="rn-metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="rn-panel" style={{ padding: 24 }}>
            <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>Sent (30 days)</div>
            <div className="rn-stat-value">{sent30}</div>
          </div>
          <div className="rn-panel" style={{ padding: 24 }}>
            <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>Failed (30 days)</div>
            <div className="rn-stat-value">{failed30}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: failed30 ? 'var(--danger)' : 'var(--success)', marginTop: 8 }}>
              {failed30 ? 'Check SMTP credentials' : 'All delivered to server'}
            </div>
          </div>
          <div className="rn-panel" style={{ padding: 24 }}>
            <div className="rn-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>By Trigger (30 days)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {triggerStats.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No emails yet.</span>}
              {triggerStats.map(t => (
                <div key={t.trigger}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{TRIGGER_LABELS[t.trigger] ?? t.trigger}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t._count._all}</span>
                  </div>
                  <div className="rn-progress-track" style={{ height: 4 }}>
                    <div className="rn-progress-fill" style={{ width: `${(t._count._all / maxTrigger) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rn-filter-bar">
          {chip('/rn/emails', 'All', !statusFilter && !triggerFilter)}
          {chip('/rn/emails?status=sent', 'Sent', statusFilter === 'sent')}
          {chip('/rn/emails?status=failed', 'Failed', statusFilter === 'failed')}
          {Object.entries(TRIGGER_LABELS).map(([key, lbl]) =>
            chip(`/rn/emails?trigger=${key}`, lbl, triggerFilter === key)
          )}
        </div>

        {/* Log table */}
        <div className="rn-panel">
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Client</th>
                  <th>Trigger</th>
                  <th>Subject</th>
                  <th>Via</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      No emails match this filter yet.
                    </td>
                  </tr>
                )}
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      {log.status === 'sent'
                        ? <span className="rn-badge success">Sent</span>
                        : <span className="rn-badge danger" title={log.error ?? undefined}>Failed</span>}
                    </td>
                    <td>
                      <Link href={`/rn/projects/${log.clientId}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{log.client.companyName || log.client.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{log.to ?? log.client.email}</div>
                      </Link>
                    </td>
                    <td>
                      <span className={`rn-badge ${log.sentBy === 'system' ? 'brand' : 'cyan'}`}>
                        {TRIGGER_LABELS[log.trigger] ?? log.trigger}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject ?? '—'}</div>
                      {log.status === 'failed' && log.error && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.error}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {log.provider}{log.sentBy !== 'system' ? ' · manual' : ' · auto'}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
