'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/navigation';

export function AdminMessenger({ clientId, adminName }: { clientId: string, adminName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/rn/projects/${clientId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // Simple poll for demo
    return () => clearInterval(interval);
  }, [clientId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    // Optimistic update
    const tempMsg = {
      id: 'temp-' + Date.now(),
      authorType: 'admin',
      authorName: isInternal ? 'Internal Note' : adminName,
      content,
      isInternalOnly: isInternal,
      isPriority,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setContent('');
    
    try {
      await fetch(`/api/rn/projects/${clientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: tempMsg.content, internal: isInternal, isPriority }),
      });
      fetchMessages();
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePin = async (msgId: string, currentPinned: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: !currentPinned } : m));
    await fetch(`/api/rn/projects/${clientId}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: !currentPinned }),
    });
  };

  const saveEdit = async (msgId: string) => {
    if (!editContent.trim()) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, editedAt: new Date().toISOString() } : m));
    setEditingId(null);
    await fetch(`/api/rn/projects/${clientId}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm('Delete this message?')) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));
    await fetch(`/api/rn/projects/${clientId}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeleted: true }),
    });
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading messages...</div>;

  const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted);
  const activeMessages = messages.filter(m => !m.isDeleted);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Project Communications</h2>
        <span style={{ fontSize: 12, color: '#64748B', background: '#E2E8F0', padding: '2px 8px', borderRadius: 99 }}>
          {activeMessages.length} Messages
        </span>
      </div>

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div style={{ padding: '12px 20px', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid rgba(59,130,246,0.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>📌 Pinned Messages</div>
          {pinnedMessages.map(m => (
            <div key={'pin-'+m.id} style={{ fontSize: 13, color: '#1E293B', marginBottom: 4, display: 'flex', gap: 8 }}>
              <span style={{ color: '#64748B' }}>{m.authorName}:</span> {m.content.slice(0, 100)}{m.content.length > 100 && '...'}
            </div>
          ))}
        </div>
      )}

      {/* Message Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 40 }}>No messages yet. Start the conversation.</div>
        )}
        
        {activeMessages.map(msg => {
          const isAdmin = msg.authorType === 'admin';
          const isInternal = msg.isInternalOnly;
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
              <div style={{ 
                maxWidth: '85%', 
                background: isInternal ? '#FFFBEB' : isAdmin ? '#EFF6FF' : '#F1F5F9',
                border: `1px solid ${isInternal ? '#FEF3C7' : isAdmin ? '#BFDBFE' : '#E2E8F0'}`,
                borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isInternal ? '#D97706' : isAdmin ? '#1D4ED8' : '#334155' }}>
                    {msg.authorName} {isInternal && '(Internal Note)'}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {msg.isPriority && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#EF4444', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>URGENT</span>}
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                  </div>
                </div>

                {editingId === msg.id ? (
                  <div>
                    <textarea 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)} 
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, minHeight: 60, fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveEdit(msg.id)} style={{ fontSize: 11, padding: '4px 10px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: '4px 10px', background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.content}
                  </div>
                )}
                
                {msg.editedAt && !editingId && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' }}>Edited</div>
                )}

                {/* Admin Actions Hover Bar */}
                {isAdmin && !editingId && (
                  <div className="msg-actions" style={{ position: 'absolute', top: -12, right: 12, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 6, display: 'flex', gap: 2, padding: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', opacity: 0.2, transition: 'opacity 0.2s' }}
                       onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                       onMouseLeave={e => e.currentTarget.style.opacity = '0.2'}>
                    <button onClick={() => togglePin(msg.id, msg.isPinned)} title="Pin Message" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 12 }}>
                      {msg.isPinned ? '📌' : '📍'}
                    </button>
                    <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 12 }}>✏️</button>
                    <button onClick={() => deleteMessage(msg.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 12 }}>🗑️</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer Input */}
      <form onSubmit={handleSend} style={{ borderTop: '1px solid #E2E8F0', padding: 16, background: '#F8FAFC' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
            🔒 Internal Note
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} />
            ⚡ Mark Priority
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={isInternal ? "Write a private note (clients won't see this)..." : "Type a message to the client..."}
            style={{ 
              flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #CBD5E1', 
              fontSize: 14, minHeight: 44, maxHeight: 120, resize: 'vertical', fontFamily: 'inherit',
              background: isInternal ? '#FFFBEB' : '#fff'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button 
            type="submit" 
            disabled={!content.trim()}
            style={{ 
              background: isInternal ? '#D97706' : '#3B82F6', color: '#fff', border: 'none', 
              padding: '0 20px', borderRadius: 8, cursor: content.trim() ? 'pointer' : 'not-allowed', 
              fontWeight: 600, transition: '0.2s', opacity: content.trim() ? 1 : 0.5 
            }}
          >
            {isInternal ? 'Save Note' : 'Send'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, textAlign: 'right' }}>
          Press Enter to send, Shift+Enter for new line
        </div>
      </form>
    </div>
  );
}
