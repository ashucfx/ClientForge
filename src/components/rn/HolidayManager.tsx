'use client';
// src/components/rn/HolidayManager.tsx — v2
// Add agency holidays with: public/custom distinction, guested toggle,
// selective client notification (all active OR pick specific clients).

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type RnClient = { id: string; name: string; companyName?: string | null; email: string };

export function HolidayManager() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<RnClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [form, setForm] = useState({
    date: '', name: '', description: '',
    isPublicHoliday: false,
    isGuested: true,
    notifyMode: 'none' as 'none' | 'all' | 'select',
    selectedClientIds: [] as string[],
  });

  const fetchClients = async () => {
    if (clients.length > 0) return;
    setLoadingClients(true);
    try {
      const res = await fetch('/api/rn/clients?lifecycleStatus=ACTIVE&limit=200');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients ?? []);
      }
    } catch { /* ignore */ }
    setLoadingClients(false);
  };

  const toggleClient = (id: string) => {
    setForm(f => ({
      ...f,
      selectedClientIds: f.selectedClientIds.includes(id)
        ? f.selectedClientIds.filter(c => c !== id)
        : [...f.selectedClientIds, id],
    }));
  };

  const save = async () => {
    if (!form.date || !form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: form.date,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isPublicHoliday: form.isPublicHoliday,
        isGuested: form.isGuested,
        notify: form.notifyMode !== 'none',
        targetClientIds: form.notifyMode === 'select' ? form.selectedClientIds : undefined,
      };
      const res = await fetch('/api/rn/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Save failed');
      setForm({ date: '', name: '', description: '', isPublicHoliday: false, isGuested: true, notifyMode: 'none', selectedClientIds: [] });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const seedPublicHolidays = async () => {
    const year = new Date().getFullYear();
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch('/api/rn/holidays/seed-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Seed failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn-secondary"
          style={{ padding: '9px 16px', fontSize: 13 }}
          onClick={seedPublicHolidays}
          disabled={seeding}
          title="Import Indian public holidays from government API"
        >
          {seeding ? '⏳ Importing…' : '🇮🇳 Seed Public Holidays'}
        </button>
        <button className="btn-primary" style={{ padding: '10px 18px', fontSize: 13 }} onClick={() => setOpen(true)}>
          + Add Holiday
        </button>
      </div>

      {open && (
        <div
          className="rn-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="rn-modal"
            style={{ maxWidth: 520 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="rn-modal-header">
              <h3 className="rn-modal-title">Add Agency Holiday</h3>
              <button className="rn-close-btn" onClick={() => setOpen(false)}>×</button>
            </div>

            <div className="rn-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Date + Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-field">
                  <label>Date</label>
                  <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Name</label>
                  <input className="input" placeholder="e.g. Diwali" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>

              {/* Description */}
              <div className="form-field">
                <label>Description <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input className="input" placeholder="Brief note shown to clients" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label className="rn-checkbox-label">
                  <input type="checkbox" checked={form.isPublicHoliday} onChange={e => setForm(f => ({ ...f, isPublicHoliday: e.target.checked }))} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Public holiday</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Government / national holiday</div>
                  </div>
                </label>
                <label className="rn-checkbox-label">
                  <input type="checkbox" checked={form.isGuested} onChange={e => setForm(f => ({ ...f, isGuested: e.target.checked }))} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Visible to clients</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Show on client portal</div>
                  </div>
                </label>
              </div>

              <hr className="rn-divider" />

              {/* Notification mode */}
              <div className="form-field">
                <label>Client Notification</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { val: 'none',   label: 'Don\'t notify anyone',   desc: 'Save silently' },
                    { val: 'all',    label: 'Notify all active clients', desc: 'Email every active RN client' },
                    { val: 'select', label: 'Notify selected clients', desc: 'Choose specific clients below' },
                  ] as const).map(opt => (
                    <label key={opt.val} className="rn-checkbox-label" style={{ alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, border: `1px solid ${form.notifyMode === opt.val ? 'var(--brand)' : 'var(--border)'}`, background: form.notifyMode === opt.val ? 'var(--brand-faint)' : 'transparent', transition: 'all 150ms var(--ease)', gap: 10 }}>
                      <input
                        type="radio" name="notifyMode" value={opt.val}
                        checked={form.notifyMode === opt.val}
                        onChange={() => {
                          setForm(f => ({ ...f, notifyMode: opt.val }));
                          if (opt.val === 'select') fetchClients();
                        }}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{opt.label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Client selector */}
              {form.notifyMode === 'select' && (
                <div className="form-field">
                  <label>Select Clients to Notify</label>
                  {loadingClients ? (
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>Loading clients…</div>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-1)' }}>
                      {clients.length === 0 ? (
                        <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-tertiary)' }}>No active clients found.</div>
                      ) : clients.map(c => (
                        <label
                          key={c.id}
                          className="rn-checkbox-label"
                          style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 10, alignItems: 'center' }}
                        >
                          <input
                            type="checkbox"
                            checked={form.selectedClientIds.includes(c.id)}
                            onChange={() => toggleClient(c.id)}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{c.companyName || c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {form.selectedClientIds.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--plasma)', fontWeight: 600, marginTop: 6 }}>
                      {form.selectedClientIds.length} client{form.selectedClientIds.length !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rn-alert danger" style={{ padding: '10px 14px', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>

            <div className="rn-modal-footer">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={save}
                disabled={saving || !form.date || !form.name.trim() || (form.notifyMode === 'select' && form.selectedClientIds.length === 0)}
              >
                {saving ? 'Saving…' : form.notifyMode === 'all' ? 'Save & Notify All' : form.notifyMode === 'select' ? `Save & Notify ${form.selectedClientIds.length}` : 'Save Holiday'}
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
      className="btn-danger"
      disabled={busy}
      style={{ padding: '4px 10px', fontSize: 11.5 }}
      onClick={async () => {
        if (!confirm('Remove this holiday?')) return;
        setBusy(true);
        await fetch(`/api/rn/holidays/${id}`, { method: 'DELETE' }).catch(() => {});
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? '…' : 'Remove'}
    </button>
  );
}
