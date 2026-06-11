import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { markConversationReadByClient } from '@/lib/communications';
import { IconMail } from '@/components/Icons';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconMail size={24} style={{ color: '#22D3EE' }} /> Project Discussion
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#A1A1AA', fontSize: 14 }}>
            No messages yet. Send a message to your project manager!
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{ 
              alignSelf: msg.authorType === 'client' ? 'flex-end' : 'flex-start',
              background: msg.authorType === 'client' ? 'linear-gradient(135deg, #7C5CFF, #22D3EE)' : 'rgba(0,0,0,0.3)',
              border: msg.authorType === 'client' ? 'none' : '1px solid rgba(255,255,255,0.1)',
              padding: '12px 16px', borderRadius: 16, maxWidth: '70%', color: '#fff', fontSize: 14
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.8 }}>
                {msg.authorName} • {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
        <form style={{ display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            placeholder="Type your message..." 
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: 8, outline: 'none' }} 
          />
          <button type="button" style={{ background: '#7C5CFF', color: '#fff', border: 'none', padding: '0 24px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
