'use client';
// src/components/rn/MilestoneManager.tsx
// Full milestone editor: create / edit / reorder / delete milestones,
// manage tasks, and run milestone payments (request → mark paid).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Task = { id: string; title: string; isCompleted: boolean };
export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  status: string;
  dueDate: string | null;
  amount: number;
  currency: string;
  paymentStatus: string;
  paidAt: string | null;
  tasks: Task[];
};

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CURRENCY_SYMBOLS[cur] ?? `${cur} `}${Math.round(amt).toLocaleString()}`;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: 'Pending',     cls: 'neutral' },
  IN_PROGRESS: { label: 'In Progress', cls: 'brand' },
  IN_REVIEW:   { label: 'In Review',   cls: 'cyan' },
  APPROVED:    { label: 'Approved',    cls: 'success' },
  COMPLETED:   { label: 'Completed',   cls: 'success' },
};

const PAYMENT_META: Record<string, { label: string; cls: string }> = {
  NOT_APPLICABLE: { label: '—',          cls: 'neutral' },
  UNPAID:         { label: 'Unpaid',     cls: 'neutral' },
  REQUESTED:      { label: 'Requested',  cls: 'warning' },
  PAID:           { label: 'Paid',       cls: 'success' },
};

function MilestoneForm({
  initial, onSave, onCancel, saving, defaultCurrency,
}: {
  initial?: Partial<MilestoneRow>;
  onSave: (data: { title: string; description: string; dueDate: string; amount: string; currency: string }) => void;
  onCancel: () => void;
  saving: boolean;
  defaultCurrency: string;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : '',
    amount: String(initial?.amount ?? 0),
    currency: initial?.currency ?? defaultCurrency,
  });
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

  return (
    <div className="rn-panel" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={label}>Milestone Title *</label>
          <input className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Homepage design & approval" />
        </div>
        <div>
          <label style={label}>Description</label>
          <textarea className="input" rows={2} style={{ width: '100%', padding: '10px 14px', fontSize: 13, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
          <div>
            <label style={label}>Due Date</label>
            <input type="date" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Payment Amount (0 = no payment)</label>
            <input type="number" min="0" className="input" style={{ width: '100%', padding: '10px 14px', fontSize: 13 }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Currency</label>
            <select className="input" style={{ width: '100%', padding: '10px 8px', fontSize: 13 }} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={onCancel}>Cancel</button>
        <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }} onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>
          {saving ? 'Saving…' : 'Save Milestone'}
        </button>
      </div>
    </div>
  );
}

export function MilestoneManager({ projectId, milestones, defaultCurrency }: { projectId: string; milestones: MilestoneRow[]; defaultCurrency: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Request failed');
      }
      router.refresh();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (form: { title: string; description: string; dueDate: string; amount: string; currency: string }) => {
    const ok = await call(`/api/rn/projects/${projectId}/milestones`, 'POST', {
      title: form.title, description: form.description, dueDate: form.dueDate || null,
      amount: Number(form.amount) || 0, currency: form.currency,
    });
    if (ok) setAdding(false);
  };

  const saveEdit = async (id: string, form: { title: string; description: string; dueDate: string; amount: string; currency: string }) => {
    const ok = await call(`/api/rn/milestones/${id}`, 'PATCH', {
      title: form.title, description: form.description, dueDate: form.dueDate || null,
      amount: Number(form.amount) || 0, currency: form.currency,
    });
    if (ok) setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && (
          <button className="btn-primary" style={{ padding: '9px 18px', fontSize: 13 }} onClick={() => { setAdding(true); setEditingId(null); }}>
            + Add Milestone
          </button>
        )}
      </div>

      {adding && (
        <MilestoneForm onSave={create} onCancel={() => setAdding(false)} saving={busy} defaultCurrency={defaultCurrency} />
      )}

      {milestones.length === 0 && !adding && (
        <div className="rn-panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          This project has no milestones yet. Projects work with or without them —
          add milestones when you want stage-gated delivery or milestone payments.
        </div>
      )}

      {milestones.map((m, idx) => {
        const sMeta = STATUS_META[m.status] ?? STATUS_META.PENDING;
        const pMeta = PAYMENT_META[m.paymentStatus] ?? PAYMENT_META.NOT_APPLICABLE;
        const doneTasks = m.tasks.filter(t => t.isCompleted).length;

        if (editingId === m.id) {
          return <MilestoneForm key={m.id} initial={m} onSave={(f) => saveEdit(m.id, f)} onCancel={() => setEditingId(null)} saving={busy} defaultCurrency={defaultCurrency} />;
        }

        return (
          <div key={m.id} className="rn-panel" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              {/* Order controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                <button className="btn-secondary" disabled={busy || idx === 0} style={{ padding: '2px 8px', fontSize: 11, opacity: idx === 0 ? 0.3 : 1 }} onClick={() => call(`/api/rn/milestones/${m.id}`, 'PATCH', { move: 'up' })}>▲</button>
                <button className="btn-secondary" disabled={busy || idx === milestones.length - 1} style={{ padding: '2px 8px', fontSize: 11, opacity: idx === milestones.length - 1 ? 0.3 : 1 }} onClick={() => call(`/api/rn/milestones/${m.id}`, 'PATCH', { move: 'down' })}>▼</button>
              </div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{idx + 1}. {m.title}</span>
                  <span className={`rn-badge ${sMeta.cls}`}>{sMeta.label}</span>
                  {m.amount > 0 && (
                    <span className={`rn-badge ${pMeta.cls}`}>
                      {money(m.amount, m.currency)} · {pMeta.label}
                    </span>
                  )}
                </div>
                {m.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{m.description}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString()}` : 'No due date'}
                  {m.tasks.length > 0 && <> · {doneTasks}/{m.tasks.length} tasks done</>}
                  {m.paidAt && <> · paid {new Date(m.paidAt).toLocaleDateString()}</>}
                </div>

                {/* Tasks */}
                {m.tasks.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.tasks.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.isCompleted ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={t.isCompleted} disabled={busy}
                          onChange={() => call(`/api/rn/tasks/${t.id}`, 'PATCH', { isCompleted: !t.isCompleted })} />
                        <span style={{ textDecoration: t.isCompleted ? 'line-through' : 'none' }}>{t.title}</span>
                        <button onClick={() => call(`/api/rn/tasks/${t.id}`, 'DELETE')} disabled={busy}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="Add a task…"
                    value={taskDrafts[m.id] ?? ''}
                    onChange={e => setTaskDrafts(d => ({ ...d, [m.id]: e.target.value }))}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && (taskDrafts[m.id] ?? '').trim()) {
                        const ok = await call(`/api/rn/milestones/${m.id}/tasks`, 'POST', { title: taskDrafts[m.id] });
                        if (ok) setTaskDrafts(d => ({ ...d, [m.id]: '' }));
                      }
                    }}
                    style={{ padding: '7px 12px', fontSize: 12.5, maxWidth: 320 }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <select
                    className="input"
                    value={m.status}
                    disabled={busy}
                    onChange={e => call(`/api/rn/milestones/${m.id}`, 'PATCH', { status: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: 12, width: 'auto' }}
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setEditingId(m.id); setAdding(false); }}>Edit</button>
                  <button className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger)' }} onClick={() => { if (confirm(`Delete milestone "${m.title}"?`)) call(`/api/rn/milestones/${m.id}`, 'DELETE'); }}>Delete</button>
                </div>
                {m.amount > 0 && m.paymentStatus !== 'PAID' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--plasma)' }}
                      onClick={() => { if (confirm(`Email a payment request for ${money(m.amount, m.currency)} to the client?`)) call(`/api/rn/milestones/${m.id}`, 'PATCH', { paymentAction: 'request' }); }}>
                      {m.paymentStatus === 'REQUESTED' ? 'Re-send Request' : 'Request Payment'}
                    </button>
                    <button className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--success)' }}
                      onClick={() => { if (confirm(`Mark ${money(m.amount, m.currency)} as received?`)) call(`/api/rn/milestones/${m.id}`, 'PATCH', { paymentAction: 'markPaid' }); }}>
                      Mark Paid
                    </button>
                  </div>
                )}
                {m.paymentStatus === 'PAID' && (
                  <button className="btn-secondary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}
                    onClick={() => { if (confirm('Revert this payment? The amount will be removed from client revenue.')) call(`/api/rn/milestones/${m.id}`, 'PATCH', { paymentAction: 'markUnpaid' }); }}>
                    Revert Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
