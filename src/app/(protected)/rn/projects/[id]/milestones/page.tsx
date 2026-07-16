// src/app/(protected)/rn/projects/[id]/milestones/page.tsx — Milestone Manager
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantDb } from '@/lib/db/tenantDb';
import { MilestoneManager, type MilestoneRow } from '@/components/rn/MilestoneManager';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CURRENCY_SYMBOLS[cur] ?? `${cur} `}${Math.round(amt).toLocaleString()}`;

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
        include: { tasks: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });

  if (!client) {
    redirect('/rn/projects');
  }

  const milestones: MilestoneRow[] = client.milestones.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    status: m.status,
    dueDate: m.dueDate?.toISOString() ?? null,
    amount: m.amount,
    currency: m.currency,
    paymentStatus: m.paymentStatus,
    paidAt: m.paidAt?.toISOString() ?? null,
    tasks: m.tasks.map(t => ({ id: t.id, title: t.title, isCompleted: t.isCompleted })),
  }));

  // Payment summary per currency
  const byCurrency = new Map<string, { total: number; paid: number }>();
  for (const m of client.milestones) {
    if (m.amount <= 0) continue;
    const entry = byCurrency.get(m.currency) ?? { total: 0, paid: 0 };
    entry.total += m.amount;
    if (m.paymentStatus === 'PAID') entry.paid += m.amount;
    byCurrency.set(m.currency, entry);
  }
  const completedCount = client.milestones.filter(m => m.status === 'COMPLETED' || m.status === 'APPROVED').length;

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <Link href="/rn/projects" style={{ color: 'var(--plasma)', textDecoration: 'none' }}>Projects</Link>
            <span>/</span>
            <Link href={`/rn/projects/${client.id}`} style={{ color: 'var(--plasma)', textDecoration: 'none' }}>{client.companyName || client.name}</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>Milestones</span>
          </div>
          <h1 className="rn-title-xl">Milestones & Payments</h1>
          <p className="rn-subtitle" style={{ marginTop: 8 }}>
            {client.milestones.length === 0
              ? 'This project runs without milestones — add them for stage-gated delivery or milestone billing.'
              : `${completedCount}/${client.milestones.length} completed`}
            {Array.from(byCurrency.entries()).map(([cur, { total, paid }]) => (
              <span key={cur}> · <span className="rn-proof">{money(paid, cur)}</span> collected of {money(total, cur)}</span>
            ))}
          </p>
        </div>

        <MilestoneManager projectId={client.id} milestones={milestones} defaultCurrency={client.currency} />
      </main>
    </RippleNexusShell>
  );
}
