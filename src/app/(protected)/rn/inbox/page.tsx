import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default async function RnInboxPage({ searchParams }: { searchParams: { client?: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');

  // Fetch all clients that have messages
  const clientsWithMessages = await tenantDb.rnClient.findMany({
    where: { messages: { some: {} } },
    include: {
      serviceModule: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const activeClientId = searchParams.client || (clientsWithMessages.length > 0 ? clientsWithMessages[0].id : null);
  
  let activeClient = null;
  let activeMessages: any[] = [];
  
  if (activeClientId) {
    activeClient = await tenantDb.rnClient.findUnique({
      where: { id: activeClientId },
      include: { serviceModule: true }
    });
    
    if (activeClient) {
      activeMessages = await tenantDb.rnMessage.findMany({
        where: { clientId: activeClient.id },
        orderBy: { createdAt: 'asc' }
      });
    }
  }

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        <header style={{ marginBottom: 32 }}>
          <h1 className="rn-title-xl">Global Inbox</h1>
          <p className="rn-subtitle" style={{ marginTop: 8 }}>Cross-project communication and notifications.</p>
        </header>

        <div className="rn-panel" style={{ flex: 1, display: 'flex', padding: 0, overflow: 'hidden' }}>
          
          {/* Thread List */}
          <div style={{ width: 350, borderRight: '1px solid var(--border)', background: 'var(--surface-2)', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <input type="text" placeholder="Search messages..." className="input" style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6 }} />
            </div>
            
            {clientsWithMessages.map((c) => {
              const latestMsg = c.messages[0];
              const isUnread = !latestMsg?.readByAdmin;
              const isActive = c.id === activeClientId;
              
              return (
                <Link key={c.id} href={`/rn/inbox?client=${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: isActive ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', position: 'relative' }}>
                    {isUnread && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--brand)' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {latestMsg?.authorName || 'System'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {latestMsg ? formatDistanceToNow(new Date(latestMsg.createdAt), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--brand)', marginBottom: 6 }}>{c.companyName || c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {latestMsg?.content || 'No messages'}
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {clientsWithMessages.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No messages found across projects.
              </div>
            )}
          </div>

          {/* Thread View */}
          {activeClient ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-1)' }}>
              <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{activeClient.serviceModule.name}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Client: {activeClient.companyName || activeClient.name}</div>
                </div>
                <Link href={`/rn/projects/${activeClient.id}`}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>Go to Project</button>
                </Link>
              </div>
              
              <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {activeMessages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', gap: 16, flexDirection: msg.authorType === 'admin' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {msg.authorName.charAt(0)}
                    </div>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexDirection: msg.authorType === 'admin' ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{msg.authorName}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div style={{ background: msg.authorType === 'admin' ? 'var(--brand-light)' : 'var(--surface-2)', padding: '12px 16px', borderRadius: msg.authorType === 'admin' ? '12px 0 12px 12px' : '0 12px 12px 12px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border)' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 24, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <textarea 
                    placeholder="Reply in Project Cockpit..." 
                    disabled
                    style={{ width: '100%', border: 'none', background: 'transparent', padding: '16px', color: 'var(--text-primary)', fontSize: 14, resize: 'none', outline: 'none' }}
                    rows={3}
                  />
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--surface-3)' }}>
                    <Link href={`/rn/projects/${activeClient.id}`}>
                      <button className="btn-primary" style={{ padding: '8px 24px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Reply in Cockpit</button>
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a thread to view messages
            </div>
          )}
        </div>
      </main>
    </RippleNexusShell>
  );
}
