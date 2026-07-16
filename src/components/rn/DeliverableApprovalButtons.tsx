'use client';
// src/components/rn/DeliverableApprovalButtons.tsx
// Client-portal controls: approve a deliverable or request changes with a note.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeliverableApprovalButtons({ deliverableId, approvalStatus }: { deliverableId: string; approvalStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');

  const act = async (action: 'approve' | 'request_changes', changeNote?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rn/client/deliverables/${deliverableId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: changeNote ?? '' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Action failed');
      }
      setAsking(false);
      setNote('');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (approvalStatus === 'APPROVED') {
    return <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', padding: '6px 12px', background: 'rgba(16,185,129,0.14)', borderRadius: 9999 }}>✓ Approved</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {approvalStatus === 'CHANGES_REQUESTED' && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', padding: '6px 12px', background: 'rgba(251,191,36,0.14)', borderRadius: 9999 }}>Changes Requested</span>
        )}
        <button
          onClick={() => act('approve')}
          disabled={busy}
          style={{ background: 'rgba(16,185,129,0.14)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {busy ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => setAsking(v => !v)}
          disabled={busy}
          style={{ background: 'transparent', color: '#C6CBDD', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Request Changes
        </button>
      </div>
      {asking && (
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change?"
            maxLength={2000}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#F4F5FA', padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none' }}
          />
          <button
            onClick={() => act('request_changes', note)}
            disabled={busy || !note.trim()}
            style={{ background: '#7C5CFF', color: '#fff', border: 'none', padding: '0 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy || !note.trim() ? 0.6 : 1 }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
