
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WorkloadKanbanPage() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('catalyst'))) {
    redirect('/login');
  }

  // Fetch all active clients
  const clients = await prisma.careerClient.findMany({
    where: {
      status: { notIn: ['COMPLETED'] }
    },
    include: {
      services: { include: { service: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const waitingOnClient = clients.filter(c => c.waitingOn === 'CLIENT');
  const waitingOnAgency = clients.filter(c => c.waitingOn === 'AGENCY');

  const Column = ({ title, items, color }: { title: string, items: typeof clients, color: string }) => (
    <div style={{ flex: 1, minWidth: 320, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
          {title}
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 12 }}>
          {items.length}
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(client => (
          <Link href={`/career/${client.id}`} key={client.id} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#121214', padding: 16, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s ease' }} className="hover:border-[var(--brand)]">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 500, color: '#fff', fontSize: 14 }}>{client.name}</span>
                <span style={{ fontSize: 11, color: 'var(--brand)' }}>{client.status.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {client.services.map(s => s.service.name).join(', ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>Updated: {new Date(client.updatedAt).toLocaleDateString()}</span>
                {client.slaDeadline && (
                  <span style={{ color: new Date(client.slaDeadline) < new Date() ? '#ef4444' : 'inherit' }}>
                    SLA: {new Date(client.slaDeadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No clients in this queue.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ padding: '40px 48px' }}>
      <main className="page-body">
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="title-xl">Workload Kanban</h1>
            <p className="subtitle mt-2">Manage your personal bandwidth based on actionable states.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 24 }}>
          <Column title="Waiting on Me (Agency)" items={waitingOnAgency} color="#ef4444" />
          <Column title="Waiting on Client" items={waitingOnClient} color="#eab308" />
        </div>
      </main>
    </div>
  );
}
