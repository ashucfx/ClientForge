import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyRnClientSession } from '@/lib/rn/auth';
import { Logo } from '@/components/Logo';
import { PortalTabs } from '@/components/rn/PortalTabs';
import OtpGate from './OtpGate';

export const dynamic = 'force-dynamic';

export default async function RnClientPortalLayout({ params, children }: { params: { token: string }, children: React.ReactNode }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token },
    include: { serviceModule: true, ConversationReadState: true }
  });

  if (!client) {
    notFound();
  }

  const tokenCookie = cookies().get('rn_client_session')?.value;
  const session = tokenCookie ? await verifyRnClientSession(tokenCookie) : null;
  const isAuthenticated = session && session.clientId === client.id;

  if (!isAuthenticated) {
    // Show OTP Gate
    return (
      <div style={{ minHeight: '100vh', background: '#0A0B14', color: '#F4F5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <OtpGate clientId={client.id} email={client.email} magicToken={params.token} />
      </div>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <div style={{ minHeight: '100vh', background: '#0A0B14', color: '#F4F5FA', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Nav */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,11,20,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo variant="horizontal" size={38} dark brandId="ripple_nexus" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F4F5FA' }}>{client.name}</div>
              <div style={{ fontSize: 11, color: '#A1A1AA' }}>{client.companyName || 'Client Portal'}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <PortalTabs token={params.token} unread={client.ConversationReadState?.unreadByClient ?? 0} />

      {/* Main Content */}
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  );
}
