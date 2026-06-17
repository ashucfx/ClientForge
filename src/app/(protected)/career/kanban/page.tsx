'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface KanbanClient {
  id: string;
  name: string;
  email: string;
  status: string;
  waitingOn: string | null;
  slaDeadline: string | null;
  updatedAt: string;
  services: Array<{ service: { name: string } }>;
}

const STATUS_COLORS: Record<string, string> = {
  UNDER_PROCESS: '#3b82f6',
  DRAFT_SENT:    '#f59e0b',
  IN_REVIEW:     '#8b5cf6',
  REVISION_REQUESTED: '#ef4444',
};

function slaClass(deadline: string | null): { color: string; label: string } | null {
  if (!deadline) return null;
  const diff = (new Date(deadline).getTime() - Date.now()) / (1000 * 3600 * 24);
  if (diff < 0)   return { color: '#ef4444', label: 'Breached' };
  if (diff <= 1)  return { color: '#ef4444', label: '< 1 day' };
  if (diff <= 3)  return { color: '#f59e0b', label: `${Math.ceil(diff)}d left` };
  return { color: '#10b981', label: `${Math.ceil(diff)}d left` };
}

function KanbanCard({ client, onStatusChange }: { client: KanbanClient; onStatusChange: () => void }) {
  const [changing, setChanging] = useState(false);
  const sla = slaClass(client.slaDeadline);
  const statusColor = STATUS_COLORS[client.status] || '#64748b';

  const toggle = async (newWaitingOn: string) => {
    if (changing) return;
    setChanging(true);
    try {
      await fetch(`/api/career/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingOn: newWaitingOn }),
      });
      onStatusChange();
    } finally { setChanging(false); }
  };

  return (
    <div style={{ background: '#0d0d0f', borderRadius: 10, border: '1px solid var(--border)', padding: 14, transition: 'border-color 0.15s' }}
      className="hover:border-[var(--brand)]">
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Link href={`/career/${client.id}`} style={{ textDecoration: 'none', flex: 1 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 13, display: 'block' }}>{client.name}</span>
        </Link>
        <span style={{ fontSize: 10, color: statusColor, fontWeight: 600, background: `${statusColor}18`, padding: '2px 7px', borderRadius: 99, flexShrink: 0, marginLeft: 8 }}>
          {client.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Services */}
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {client.services.map(s => s.service.name).join(', ') || '—'}
      </p>

      {/* SLA + Updated */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          Updated {new Date(client.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
        {sla && (
          <span style={{ fontSize: 10, fontWeight: 700, color: sla.color, background: `${sla.color}18`, padding: '2px 7px', borderRadius: 99 }}>
            SLA: {sla.label}
          </span>
        )}
      </div>

      {/* Quick action — move to other column */}
      <div style={{ display: 'flex', gap: 6 }}>
        {client.waitingOn === 'AGENCY' ? (
          <button
            onClick={() => toggle('CLIENT')}
            disabled={changing}
            style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #eab30840', background: '#eab30810', color: '#eab308', cursor: 'pointer' }}
          >
            {changing ? '…' : '→ Move to Waiting on Client'}
          </button>
        ) : (
          <button
            onClick={() => toggle('AGENCY')}
            disabled={changing}
            style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #ef444440', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}
          >
            {changing ? '…' : '→ Move to My Queue'}
          </button>
        )}
        <Link href={`/career/${client.id}`}
          style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Open
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({ title, color, clients, onStatusChange }: {
  title: string; color: string; clients: KanbanClient[]; onStatusChange: () => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 300, maxWidth: 420, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {title}
        </h2>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.08)', padding: '2px 10px', borderRadius: 12 }}>
          {clients.length}
        </span>
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
          All clear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map(c => (
            <KanbanCard key={c.id} client={c} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkloadKanbanPage() {
  const [clients, setClients] = useState<KanbanClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/career/admin/clients?kanban=true&pageSize=200');
      if (res.ok) {
        const data = await res.json();
        const all: KanbanClient[] = (data.clients || data.data || []).filter(
          (c: KanbanClient) => c.status !== 'NOT_STARTED' && c.status !== 'COMPLETED'
        );
        setClients(all);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? clients.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.services.some(s => s.service.name.toLowerCase().includes(filter.toLowerCase()))
      )
    : clients;

  const myQueue      = filtered.filter(c => c.waitingOn === 'AGENCY');
  const clientQueue  = filtered.filter(c => c.waitingOn === 'CLIENT');
  const noWaiting    = filtered.filter(c => !c.waitingOn || (c.waitingOn !== 'AGENCY' && c.waitingOn !== 'CLIENT'));
  const slaBreached  = clients.filter(c => c.slaDeadline && new Date(c.slaDeadline) < new Date()).length;

  return (
    <AppShell>
      <div style={{ padding: '36px 40px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="title-xl">Workload Kanban</h1>
            <p className="subtitle mt-2">Active client pipeline by action queue.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {slaBreached > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#ef444415', border: '1px solid #ef444430', padding: '4px 12px', borderRadius: 99 }}>
                ⚠ {slaBreached} SLA breached
              </span>
            )}
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter clients…"
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, width: 200, outline: 'none' }}
            />
            <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'My Queue', count: myQueue.length, color: '#ef4444' },
            { label: 'Waiting on Client', count: clientQueue.length, color: '#eab308' },
            { label: 'Other Active', count: noWaiting.length, color: '#64748b' },
            { label: 'Total Active', count: filtered.length, color: '#B8935B' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 20px', minWidth: 110 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 24, alignItems: 'flex-start' }}>
            <KanbanColumn title="My Queue (Agency)" color="#ef4444" clients={myQueue} onStatusChange={load} />
            <KanbanColumn title="Waiting on Client" color="#eab308" clients={clientQueue} onStatusChange={load} />
            {noWaiting.length > 0 && (
              <KanbanColumn title="Other Active" color="#64748b" clients={noWaiting} onStatusChange={load} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
