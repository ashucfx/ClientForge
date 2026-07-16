'use client';
// src/components/rn/InboxComposer.tsx
// Live reply composer for the RN admin inbox — posts through the existing
// project messages API and refreshes the server-rendered thread.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InboxComposer({ clientId }: { clientId: string }) {
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
      const res = await fetch(`/api/rn/projects/${clientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to send');
      }
      setContent('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Reply to the client… (Ctrl+Enter to send)"
          rows={3}
          disabled={sending}
          style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', color: 'var(--text-primary)', fontSize: 14, resize: 'none', outline: 'none' }}
        />
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-3)' }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error ?? ''}</span>
          <button
            className="btn-primary"
            onClick={send}
            disabled={sending || !content.trim()}
            style={{ padding: '8px 24px', borderRadius: 6, fontSize: 13, fontWeight: 600, opacity: sending || !content.trim() ? 0.6 : 1 }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
