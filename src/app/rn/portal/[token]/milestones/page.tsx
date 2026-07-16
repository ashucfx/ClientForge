import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { IconCheck } from '@/components/Icons';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CURRENCY_SYMBOLS[cur] ?? `${cur} `}${Math.round(amt).toLocaleString()}`;

export default async function RnPortalMilestonesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { createdAt: 'asc' } } }
      }
    }
  });

  if (!client) notFound();

  const milestones = client.milestones || [];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12, background: 'linear-gradient(135deg, #F4F5FA 0%, #A1A1AA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Project Milestones
        </h1>
        <p style={{ fontSize: 16, color: '#A1A1AA', maxWidth: 600, lineHeight: 1.6 }}>
          Track the detailed progress of your project sprints, tasks, and milestone payments.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {milestones.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#A1A1AA' }}>No milestones have been defined yet.</p>
          </div>
        ) : (
          milestones.map((m: any) => (
            <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#F4F5FA' }}>{m.title}</h2>
                  {m.dueDate && (
                    <div style={{ fontSize: 12, color: '#A1A1AA' }}>
                      Due: {format(new Date(m.dueDate), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {m.amount > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 9999,
                      color: m.paymentStatus === 'PAID' ? '#22c55e' : m.paymentStatus === 'REQUESTED' ? '#FBBF24' : '#A1A1AA',
                      background: m.paymentStatus === 'PAID' ? 'rgba(34,197,94,0.12)' : m.paymentStatus === 'REQUESTED' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)'
                    }}>
                      {money(m.amount, m.currency)} · {m.paymentStatus === 'PAID' ? 'PAID' : m.paymentStatus === 'REQUESTED' ? 'PAYMENT DUE' : 'UPCOMING'}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
                    color: (m.status === 'APPROVED' || m.status === 'COMPLETED') ? '#22c55e' : m.status === 'IN_PROGRESS' ? '#22D3EE' : '#A1A1AA',
                    background: (m.status === 'APPROVED' || m.status === 'COMPLETED') ? 'rgba(34,197,94,0.1)' : m.status === 'IN_PROGRESS' ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)'
                  }}>
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div style={{ padding: '0 24px' }}>
                {m.tasks.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ 
                      width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${t.isCompleted ? '#22c55e' : '#52525B'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.isCompleted ? '#22c55e' : 'transparent'
                    }}>
                      {t.isCompleted && <IconCheck size={12} style={{ color: '#fff' }} />}
                    </div>
                    <span style={{ color: t.isCompleted ? '#A1A1AA' : '#F4F5FA', textDecoration: t.isCompleted ? 'line-through' : 'none', fontSize: 14 }}>
                      {t.title}
                    </span>
                  </div>
                ))}
                {m.tasks.length === 0 && (
                  <div style={{ padding: '16px 0', color: '#71717A', fontSize: 13, fontStyle: 'italic' }}>
                    No tasks defined for this milestone.
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
