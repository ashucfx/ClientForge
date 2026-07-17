'use client';
// src/components/rn/PortalMessageComposer.tsx
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
    <div className="chat-input-area">
      <form className="chat-input-wrapper" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          type="text"
          className="chat-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
          maxLength={4000}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={sending || !content.trim()}
          style={{ opacity: sending || !content.trim() ? 0.5 : 1 }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      {error && (
        <div style={{ marginTop: 8, color: 'var(--rn-danger)', fontSize: 12 }}>{error}</div>
      )}
    </div>
  );
}
