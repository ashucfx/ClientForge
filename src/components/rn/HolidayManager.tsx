'use client';
// src/components/rn/HolidayManager.tssx — add/remove agency holidays,
// optionally notifying every active client by email.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function HolidayManager() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', description: '', notify: false });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.date || !form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/rn/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Save failed');
      setForm({ date: '', name: '', description: '', notify: false });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

  return (
    <>
      <button className="btn-primary" style={{ padding: '10px 18px', fontSize: 13 }} onClick={() => setOpen(true)}>
        + Add Holiday
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,20,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setOpen(false)}>
          <div className="rn-panel" style={{ width: '100%', maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Add Agency Holiday</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Date</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Name</label>
                  <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} placeholder="e.g. Diwali" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={label}>Description (optional)</label>
                <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.notify} onChange={e => setForm(f => ({ ...f, notify: e.target.checked }))} />
                Email all active clients about this closure
              </label>
              {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }} onClick={save} disabled={saving || !form.date || !form.name.trim()}>
                {saving ? 'Saving…' : form.notify ? 'Save & Notify Clients' : 'Save Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      style={{ padding: '4px 10px', fontSize: 11.5, color: 'var(--danger)' }}
      onClick={async () => {
        if (!confirm('Remove this holiday?')) return;
        setBusy(true);
        await fetch(`/api/rn/holidays/${id}`, { method: 'DELETE' }).catch(() => {});
        setBusy(false);
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
