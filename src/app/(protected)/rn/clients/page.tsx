import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isRnModuleEnabled } from '@/lib/brand/flags';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { IconUser, IconLink } from '@/components/Icons';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function RnClientsPage() {
  if (!isRnModuleEnabled()) {
    redirect('/');
  }

  const clients = await prisma.rnClient.findMany({
    orderBy: { createdAt: 'desc' },
    include: { ConversationReadState: true }
  });

  return (
    <RippleNexusShell>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title" style={{ color: '#A78BFA' }}>Agency Clients</h1>
            <p className="page-subtitle">Ripple Nexus B2B Client Directory</p>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Invoices</th>
                  <th>SLA Status</th>
                  <th>Portal Link</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '64px 0' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No agency clients yet</div>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Clients will appear here automatically when a Ripple Nexus invoice is paid.</p>
                    </td>
                  </tr>
                ) : clients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f0ff', color: '#7C5CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {client.name}
                          {client.ConversationReadState?.unreadByAdmin ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9999, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                              {client.ConversationReadState.unreadByAdmin > 99 ? '99+' : client.ConversationReadState.unreadByAdmin}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{client.companyName || '—'}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{client.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{client.phone}</div>
                    </td>
                    <td>
                      {client.invoiceId ? (
                        <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', fontSize: 11 }}>
                          Invoice Linked
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {client.ConversationReadState?.adminSlaDeadline ? (
                        (() => {
                          const deadline = new Date(client.ConversationReadState.adminSlaDeadline);
                          const isBreached = deadline.getTime() < Date.now();
                          const isDueSoon = deadline.getTime() - Date.now() < 2 * 60 * 60 * 1000 && !isBreached;
                          
                          if (isBreached) return <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#b91c1c' }}>🔴 Breached</span>;
                          if (isDueSoon) return <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#b45309' }}>🟡 Due Soon</span>;
                          return <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#dcfce3', color: '#15803d' }}>🟢 Healthy</span>;
                        })()
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <a href={`/rn/portal/${client.magicToken}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#7C5CFF' }}>
                        <IconLink size={14} style={{ marginRight: 6 }} /> Open Portal
                      </a>
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {format(new Date(client.createdAt), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RippleNexusShell>
  );
}
