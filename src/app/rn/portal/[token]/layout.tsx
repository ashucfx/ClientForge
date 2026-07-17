import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { Logo } from '@/components/Logo';
import OtpGate from './OtpGate';
import PortalNavClient from './PortalNavClient';
import '../portal.css';

export const dynamic = 'force-dynamic';

export default async function RnClientPortalLayout({ params, children }: { params: { token: string }, children: React.ReactNode }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: { serviceModule: true, ConversationReadState: true }
  });

  if (!client) notFound();

  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  const isAuthenticated = session && session.clientId === client.id;

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0B14', color: '#F4F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <OtpGate clientId={client.id} email={client.email} magicToken={params.token} />
      </div>
    );
  }

  const unread = client.ConversationReadState?.unreadByClient ?? 0;
  const base = `/rn/portal/${params.token}`;
  const initial = client.name.charAt(0).toUpperCase();
  const serviceName = client.serviceModule.name;

  return (
    <div className="portal-root">
      {/* Topbar */}
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <div className="portal-brand">
            <Logo variant="horizontal" size={34} brandId="ripple_nexus" />
            <span className="portal-project-name">{serviceName}</span>
          </div>
          <div className="portal-user-badge">
            <div className="portal-user-info">
              <div className="portal-user-name">{client.name}</div>
              <div className="portal-user-company">{client.companyName || 'Client Portal'}</div>
            </div>
            <div className="portal-avatar">{initial}</div>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="portal-layout">
        {/* Desktop sidebar nav */}
        <aside className="portal-sidebar">
          <PortalNavClient token={params.token} unread={unread} />
        </aside>

        {/* Page content */}
        <main className="portal-main">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="portal-mobile-nav">
        <div className="portal-mobile-nav-inner">
          <PortalNavClient token={params.token} unread={unread} mobile />
        </div>
      </nav>
    </div>
  );
}
