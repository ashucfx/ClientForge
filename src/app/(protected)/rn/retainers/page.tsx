// src/app/(protected)/rn/retainers/page.tsx — Retainer Management Portal
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format, differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import type { RnRetainer, RnClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };

const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    cls: 'success' },
  PAUSED:    { label: 'Paused',    cls: 'warning' },
  CANCELLED: { label: 'Cancelled', cls: 'danger'  },
  EXPIRED:   { label: 'Expired',   cls: 'neutral'  },
} as const;

const TYPE_CONFIG: Record<string, string> = {
  MONTHLY:     'Monthly',
  QUARTERLY:   'Quarterly',
  ANNUAL:      'Annual',
  MAINTENANCE: 'Maintenance',
  CUSTOM:      'Custom',
};

export default async function RetainersPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const statusFilter = searchParams.status ?? 'ACTIVE';

  type RetainerWithClient = RnRetainer & {
    client: { id: string; name: string; companyName: string | null; email: string; country: string | null };
  };

  const retainers = await prisma.rnRetainer.findMany({
    where: statusFilter === 'ALL' ? {} : { status: statusFilter },
    include: { client: { select: { id: true, name: true, companyName: true, email: true, country: true } } },
    orderBy: { nextBillingAt: 'asc' },
  }) as RetainerWithClient[];

  const allRetainers = await prisma.rnRetainer.findMany({ select: { status: true, amount: true, currency: true } });
  const active = allRetainers.filter(r => r.status === 'ACTIVE');
  const totalByC = new Map<string, number>();
  for (const r of active) totalByC.set(r.currency, (totalByC.get(r.currency) ?? 0) + r.amount);
  const mrr = Array.from(totalByC.entries()).map(([c, a]) => `${CURRENCY_SYMBOLS[c] ?? c}${Math.round(a).toLocaleString()}`).join(' + ') || '—';

  const dueThisWeek = retainers.filter(r => {
    const days = differenceInCalendarDays(new Date(r.nextBillingAt), new Date());
    return r.status === 'ACTIVE' && days >= 0 && days <= 7;
  });

  return (
    <RippleNexusShell>
      <main className="rn-page">

        <header className="rn-page-header">
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Operations</div>
            <h1 className="rn-title-xl">Retainer Management</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              Subscriptions, maintenance contracts, and recurring engagements.
            </p>
          </div>
          <Link href="/rn/retainers/new" className="btn-primary">+ New Retainer</Link>
        </header>

        {/* Summary metrics */}
        <div className="rn-three-col" style={{ marginBottom: 24 }}>
          <div className="rn-stat-card hover-lift">
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔄</div>
            <div className="rn-eyebrow" style={{ marginBottom: 6, fontSize: 11 }}>Monthly Recurring Revenue</div>
            <div className="rn-stat-value" style={{ fontSize: 26, marginBottom: 4 }}>{mrr}</div>
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{active.length} active contract{active.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="rn-stat-card hover-lift">
            <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
            <div className="rn-eyebrow" style={{ marginBottom: 6, fontSize: 11 }}>Billing Due This Week</div>
            <div className="rn-stat-value" style={{ fontSize: 26, marginBottom: 4 }}>{dueThisWeek.length}</div>
            <div style={{ fontSize: 12, color: dueThisWeek.length > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
              {dueThisWeek.length > 0 ? 'Invoices to create' : 'Nothing due'}
            </div>
          </div>
          <div className="rn-stat-card hover-lift">
            <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
            <div className="rn-eyebrow" style={{ marginBottom: 6, fontSize: 11 }}>Total Contracts</div>
            <div className="rn-stat-value" style={{ fontSize: 26, marginBottom: 4 }}>{allRetainers.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {allRetainers.filter(r => r.status === 'CANCELLED').length} cancelled
            </div>
          </div>
        </div>

        {/* Due this week alert */}
        {dueThisWeek.length > 0 && (
          <div className="rn-alert warning" style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <div>
              <strong>{dueThisWeek.length} retainer{dueThisWeek.length !== 1 ? 's' : ''} billing due within 7 days</strong>
              {' — '}{dueThisWeek.map(r => r.client.companyName || r.client.name).slice(0, 3).join(', ')}
              {dueThisWeek.length > 3 ? ` +${dueThisWeek.length - 3} more` : ''}. Create invoices from each retainer page.
            </div>
          </div>
        )}

        {/* Status filters */}
        <div className="rn-filter-bar">
          {(['ACTIVE', 'PAUSED', 'CANCELLED', 'ALL'] as const).map(s => (
            <Link key={s} href={`/rn/retainers?status=${s}`} className={`rn-chip${statusFilter === s ? ' active' : ''}`}>
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
            </Link>
          ))}
        </div>

        {/* Retainers list */}
        {retainers.length === 0 ? (
          <div className="rn-panel">
            <div className="rn-empty">
              <div className="rn-empty-icon" style={{ fontSize: 28 }}>🔄</div>
              <p className="rn-empty-title">No retainers{statusFilter !== 'ALL' ? ` with status: ${statusFilter}` : ''}</p>
              <p className="rn-empty-desc">
                {statusFilter === 'ACTIVE' ? 'Create your first recurring engagement to start tracking monthly revenue.' : 'No contracts match this filter.'}
              </p>
              {statusFilter === 'ACTIVE' && <Link href="/rn/retainers/new" className="btn-primary" style={{ marginTop: 8 }}>+ New Retainer</Link>}
            </div>
          </div>
        ) : (
          <div className="rn-panel" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Plan / Type</th>
                  <th>Amount</th>
                  <th>Gateway</th>
                  <th>Next Billing</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {retainers.map(r => {
                  const sym = CURRENCY_SYMBOLS[r.currency] ?? r.currency;
                  const daysLeft = differenceInCalendarDays(new Date(r.nextBillingAt), new Date());
                  const statusCfg = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? { label: r.status, cls: 'neutral' };
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.client.companyName || r.client.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.name}</div>
                      </td>
                      <td>
                        <span className="rn-badge brand" style={{ fontSize: 11 }}>{TYPE_CONFIG[r.type] ?? r.type}</span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 15 }}>
                        {sym}{r.amount.toLocaleString()}
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{r.currency} / {(r.type || 'mo').toLowerCase()}</div>
                      </td>
                      <td>
                        <span className={`rn-badge ${r.paymentGateway === 'PAYPAL' ? 'cyan' : 'brand'}`} style={{ fontSize: 10.5, textTransform: 'uppercase' }}>
                          {r.paymentGateway === 'PAYPAL' ? '🌐 PayPal' : '⚡ Razorpay'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: daysLeft <= 3 ? 'var(--warning)' : 'var(--text-primary)' }}>
                          {format(new Date(r.nextBillingAt), 'MMM d, yyyy')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {daysLeft <= 0 ? 'Overdue' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                        </div>
                      </td>
                      <td>
                        <span className={`rn-badge ${statusCfg.cls}`}>{statusCfg.label}</span>
                        {r.autoRenew && r.status === 'ACTIVE' && (
                          <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 3, fontWeight: 600 }}>↻ Auto-renew</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/rn/retainers/${r.id}`} className="btn-secondary" style={{ padding: '7px 14px', fontSize: 12, textDecoration: 'none' }}>
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </RippleNexusShell>
  );
}
