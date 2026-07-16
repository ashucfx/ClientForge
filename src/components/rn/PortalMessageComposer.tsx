'use client';
// src/components/rn/PortalMessageComposer.tsx
// Client-portal message composer (dark theme) — replaces the old dead form.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PortalMessageComposer() {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/rn/client/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to send message');
      }
      setContent('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
      <form
        style={{ display: 'flex', gap: 12 }}
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
          maxLength={4000}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: 8, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          style={{ background: '#7C5CFF', color: '#fff', border: 'none', padding: '0 24px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: sending || !content.trim() ? 0.6 : 1 }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error && (
        <div style={{ marginTop: 8, color: '#f87171', fontSize: 12 }}>{error}</div>
      )}
    </div>
  );
}
