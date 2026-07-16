import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { InboxComposer } from '@/components/rn/InboxComposer';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantDb } from '@/lib/db/tenantDb';
import { markConversationReadByAdmin } from '@/lib/communications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RnInboxPage({ searchParams }: { searchParams: { client?: string; q?: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const tenantDb = getTenantDb('ripple_nexus');
  const q = (searchParams.q ?? '').trim();

  // Fetch all clients that have messages (optionally filtered by search)
  const clientsWithMessages = await tenantDb.rnClient.findMany({
    where: {
      messages: { some: {} },
      ...(q
        ? {
            OR: [
              { name:        { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { email:       { contains: q, mode: 'insensitive' } },
              { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    include: {
      serviceModule: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // A thread is "explicitly open" when ?client= is present — this drives the
  // mobile list/thread stacking. On desktop we auto-open the first thread.
  const explicitClientId = searchParams.client || null;
  const activeClientId = explicitClientId || (clientsWithMessages.length > 0 ? clientsWithMessages[0].id : null);

  let activeClient = null;
  let activeMessages: any[] = [];

  if (activeClientId) {
    activeClient = await tenantDb.rnClient.findUnique({
      where: { id: activeClientId },
      include: { serviceModule: true },
    });

    if (activeClient) {
      activeMessages = await tenantDb.rnMessage.findMany({
        where: { clientId: activeClient.id, isInternalOnly: false },
        orderBy: { createdAt: 'asc' },
      });
      // Opening a thread marks it read — keeps the sidebar badge honest.
      await markConversationReadByAdmin(activeClient.id, 'RN').catch(() => {});
    }
  }

  const listQuerySuffix = q ? `&q=${encodeURIComponent(q)}` : '';

  return (
    <RippleNexusShell>
      <main className="rn-page rn-inbox-page">

        <header style={{ marginBottom: 20 }}>
          {explicitClientId && (
            <Link href={q ? `/rn/inbox?q=${encodeURIComponent(q)}` : '/rn/inbox'} className="rn-inbox-back">
              ← All conversations
            </Link>
          )}
          <h1 className="rn-title-xl">Inbox</h1>
          <p className="rn-subtitle" style={{ marginTop: 6 }}>Cross-project communication with your clients.</p>
        </header>

        <div className={`rn-panel rn-inbox${activeClient && explicitClientId ? ' has-thread' : ''}`} style={{ flex: 1 }}>

          {/* Thread List */}
          <div className="rn-inbox-list">
            <form method="GET" action="/rn/inbox" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search conversations…"
                className="input"
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6 }}
              />
            </form>

            {clientsWithMessages.map((c) => {
              const latestMsg = c.messages[0];
              const isUnread = latestMsg?.authorType === 'client' && !latestMsg?.readByAdmin;
              const isActive = c.id === activeClientId;

              return (
                <Link key={c.id} href={`/rn/inbox?client=${c.id}${listQuerySuffix}`} style={{ textDecoration: 'none' }}>
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
                {q ? `No conversations match “${q}”.` : 'No messages found across projects.'}
              </div>
            )}
          </div>

          {/* Thread View */}
          {activeClient ? (
            <div className="rn-inbox-thread">
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{activeClient.serviceModule.name}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Client: {activeClient.companyName || activeClient.name}</div>
                </div>
                <Link href={`/rn/projects/${activeClient.id}`} className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, textDecoration: 'none', flexShrink: 0 }}>
                  Go to Project
                </Link>
              </div>

              <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {activeMessages.length === 0 && (
                  <div style={{ margin: 'auto', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    No messages yet — start the conversation below.
                  </div>
                )}
                {activeMessages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', gap: 12, flexDirection: msg.authorType === 'admin' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {msg.authorName.charAt(0)}
                    </div>
                    <div style={{ maxWidth: '75%', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexDirection: msg.authorType === 'admin' ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{msg.authorName}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div style={{ background: msg.authorType === 'admin' ? 'var(--brand-light)' : 'var(--surface-2)', padding: '12px 16px', borderRadius: msg.authorType === 'admin' ? '12px 0 12px 12px' : '0 12px 12px 12px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <InboxComposer clientId={activeClient.id} />
            </div>
          ) : (
            <div className="rn-inbox-thread" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a thread to view messages
            </div>
          )}
        </div>
      </main>
    </RippleNexusShell>
  );
}
