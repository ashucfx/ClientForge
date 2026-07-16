import Link from 'next/link';
import { prisma } from '@/lib/db';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { PortalLinkActions } from '@/components/rn/PortalLinkActions';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };

function healthBadge(status?: string | null) {
  switch (status) {
    case 'EXCELLENT':        return <span className="rn-badge success">Excellent</span>;
    case 'HEALTHY':          return <span className="rn-badge success">Healthy</span>;
    case 'ATTENTION_NEEDED': return <span className="rn-badge warning">Attention</span>;
    case 'AT_RISK':          return <span className="rn-badge danger">At Risk</span>;
    default:                 return <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>;
  }
}

export default async function RnClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();

  const clients = await prisma.rnClient.findMany({
    where: q
      ? {
          OR: [
            { name:        { contains: q, mode: 'insensitive' } },
            { email:       { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      ConversationReadState: true,
      ClientHealthScore: true,
      serviceModule: { select: { name: true } },
    },
  });

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Operations</div>
            <h1 className="rn-title-xl">Agency Clients</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              {clients.length} client{clients.length === 1 ? '' : 's'} · Ripple Nexus B2B directory
            </p>
          </div>
          <Link href="/rn/projects/new">
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}>+ New Client Project</button>
          </Link>
        </header>

        <form method="GET" action="/rn/clients" className="rn-filter-bar">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, company, or email…"
            className="input"
            style={{ minWidth: 260 }}
          />
          {q && <Link href="/rn/clients" className="rn-chip">Clear ✕</Link>}
        </form>

        <div className="rn-panel">
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Revenue</th>
                  <th>Health</th>
                  <th>SLA</th>
                  <th>Portal</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '64px 0' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {q ? `No clients match “${q}”` : 'No agency clients yet'}
                      </div>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                        {q ? 'Try a different search.' : 'Clients appear automatically when a Ripple Nexus invoice is paid, or create a project manually.'}
                      </p>
                    </td>
                  </tr>
                ) : clients.map(client => {
                  const sym = CURRENCY_SYMBOLS[client.currency] ?? `${client.currency} `;
                  return (
                    <tr key={client.id}>
                      <td>
                        <Link href={`/rn/projects/${client.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--plasma)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {client.name}
                              {client.ConversationReadState?.unreadByAdmin ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9999, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 6px' }}>
                                  {client.ConversationReadState.unreadByAdmin > 99 ? '99+' : client.ConversationReadState.unreadByAdmin}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              {client.companyName || client.email}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{client.serviceModule?.name ?? '—'}</td>
                      <td>
                        {client.amountPaid > 0
                          ? <span className="rn-proof">{sym}{Math.round(client.amountPaid).toLocaleString()}</span>
                          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td>{healthBadge(client.ClientHealthScore?.status)}</td>
                      <td>
                        {client.ConversationReadState?.adminSlaDeadline ? (
                          (() => {
                            const deadline = new Date(client.ConversationReadState.adminSlaDeadline);
                            const isBreached = deadline.getTime() < Date.now();
                            const isDueSoon = deadline.getTime() - Date.now() < 2 * 60 * 60 * 1000 && !isBreached;
                            if (isBreached) return <span className="rn-badge danger">Breached</span>;
                            if (isDueSoon) return <span className="rn-badge warning">Due Soon</span>;
                            return <span className="rn-badge success">Healthy</span>;
                          })()
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <PortalLinkActions clientId={client.id} compact />
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {format(new Date(client.createdAt), 'MMM dd, yyyy')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
