'use client';
// src/components/rn/EmailComposer.tsx
// Manual email compose for the RN Email Center — picks a client, sends a
// branded SMTP email, logged like every other send.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EmailComposer({ clients }: { clients: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ clientId: clients[0]?.id ?? '', subject: '', message: '' });
  const [notice, setNotice] = useState<string | null>(null);

  const send = async () => {
    if (!form.clientId || !form.subject.trim() || !form.message.trim() || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch('/api/rn/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Send failed');
      setForm(f => ({ ...f, subject: '', message: '' }));
      setOpen(false);
      router.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

  return (
    <>
      <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13 }} onClick={() => setOpen(true)} disabled={clients.length === 0}>
        ✉ Compose Email
      </button>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,20,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setOpen(false)}
        >
          <div className="rn-panel" style={{ width: '100%', maxWidth: 540, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Send Email to Client</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Client</label>
                <select className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Subject</label>
                <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label style={label}>Message (blank line = new paragraph)</label>
                <textarea className="input" rows={7} style={{ width: '100%', padding: '10px 14px', fontSize: 13, resize: 'vertical' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} maxLength={10000} />
              </div>
              {notice && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{notice}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Sent with the Ripple Nexus brand template and logged below.</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }} onClick={send} disabled={sending || !form.subject.trim() || !form.message.trim()}>
                  {sending ? 'Sending…' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
