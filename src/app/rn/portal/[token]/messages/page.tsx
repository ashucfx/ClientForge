// src/app/rn/portal/[token]/messages/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { markConversationReadByClient } from '@/lib/communications';
import { PortalMessageComposer } from '@/components/rn/PortalMessageComposer';

export const dynamic = 'force-dynamic';

export default async function RnMessagesPage({ params }: { params: { token: string } }) {
  const client = await prisma.rnClient.findFirst({
    where: { magicToken: params.token }
  });

  if (!client) notFound();

  // Fetch messages from DB
  const messages = await prisma.rnMessage.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'asc' }
  });

  // Mark as read by client
  await markConversationReadByClient(client.id, 'RN');

  return (
    <div className="portal-messages">
      <div className="dashboard-header-block mb-6">
        <div className="header-greeting">
          <h1>Message Center</h1>
          <p>Communicate directly with your project team.</p>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state-mini" style={{ margin: 'auto' }}>
              No messages yet. Send a message to your project manager!
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`chat-bubble ${msg.authorType === 'client' ? 'client' : 'admin'}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                <div className="chat-meta text-right">
                  {msg.authorName} • {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            ))
          )}
        </div>
        <PortalMessageComposer />
      </div>
    </div>
  );
}
