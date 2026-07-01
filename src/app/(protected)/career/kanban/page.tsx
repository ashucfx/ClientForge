'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

type Column = 'AGENCY' | 'CLIENT' | 'OTHER';

const STATUS_COLORS: Record<string, string> = {
  UNDER_PROCESS:       '#3b82f6',
  DRAFT_SENT:          '#f59e0b',
  IN_REVIEW:           '#8b5cf6',
  REVISION_REQUESTED:  '#ef4444',
};

const COL_META: Record<Column, { title: string; color: string; waitingOn: string | null }> = {
  AGENCY:  { title: 'My Queue',         color: '#ef4444', waitingOn: 'AGENCY' },
  CLIENT:  { title: 'Waiting on Client', color: '#eab308', waitingOn: 'CLIENT' },
  OTHER:   { title: 'Other Active',      color: '#64748b', waitingOn: null },
};

function countBizDays(start: Date, end: Date): number {
  const d = new Date(start);
  let n = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

function slaInfo(deadline: string | null): { color: string; label: string } | null {
  if (!deadline) return null;
  const now = new Date();
  const end = new Date(deadline);
  if (end <= now) return { color: '#ef4444', label: 'SLA Breached' };
  const bd = countBizDays(now, end);
  if (bd === 0) return { color: '#ef4444', label: 'SLA today' };
  if (bd === 1) return { color: '#ef4444', label: 'SLA 1bd' };
  if (bd <= 2)  return { color: '#f59e0b', label: `SLA ${bd}bd` };
  return { color: '#10b981', label: `SLA ${bd}bd` };
}

function clientColumn(c: KanbanClient): Column {
  if (c.waitingOn === 'AGENCY') return 'AGENCY';
  if (c.waitingOn === 'CLIENT') return 'CLIENT';
  return 'OTHER';
}

// ── Drag state singleton (avoids prop drilling) ───────────────────
let dragId: string | null = null;

function KanbanCard({
  client,
  onMove,
  onRefresh,
}: {
  client: KanbanClient;
  onMove: (id: string, col: Column) => void;
  onRefresh: () => void;
}) {
  const sla = slaInfo(client.slaDeadline);
  const statusColor = STATUS_COLORS[client.status] || '#64748b';
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const moveTo = async (newWaitingOn: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await fetch(`/api/career/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingOn: newWaitingOn }),
      });
      onRefresh();
    } finally { setSaving(false); }
  };

  // HTML5 drag
  const handleDragStart = (e: React.DragEvent) => {
    dragId = client.id;
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current) cardRef.current.style.opacity = '0.5';
  };
  const handleDragEnd = () => {
    dragId = null;
    if (cardRef.current) cardRef.current.style.opacity = '';
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        background: '#fff',
        borderRadius: 10,
        border: `1px solid var(--border)`,
        padding: '12px 14px',
        cursor: 'grab',
        transition: 'box-shadow 0.15s',
        boxShadow: 'var(--shadow-xs)',
        userSelect: 'none',
      }}
    >
      {/* Status + Name */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Link href={`/career/${client.id}`} style={{ textDecoration: 'none', flex: 1 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{client.name}</span>
        </Link>
        <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, background: `${statusColor}18`, padding: '2px 7px', borderRadius: 99, flexShrink: 0, marginLeft: 8 }}>
          {client.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Services */}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {client.services.map(s => s.service.name).join(', ') || '—'}
      </p>

      {/* SLA + last updated */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {new Date(client.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
        {sla && (
          <span style={{ fontSize: 10, fontWeight: 700, color: sla.color, background: `${sla.color}18`, padding: '2px 7px', borderRadius: 99 }}>
            {sla.label}
          </span>
        )}
      </div>

      {/* Quick move + open */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {client.waitingOn !== 'CLIENT' && (
          <button onClick={() => moveTo('CLIENT')} disabled={saving}
            style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: '1px solid #eab30840', background: '#eab30810', color: '#ca9a00', cursor: 'pointer' }}>
            {saving ? '…' : '→ Client'}
          </button>
        )}
        {client.waitingOn !== 'AGENCY' && (
          <button onClick={() => moveTo('AGENCY')} disabled={saving}
            style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: '1px solid #ef444440', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}>
            {saving ? '…' : '→ My Queue'}
          </button>
        )}
        <Link href={`/career/${client.id}`}
          style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Open
        </Link>
      </div>
    </div>
  );
}

function KanbanCol({
  col, clients, onMove, onRefresh,
}: {
  col: Column; clients: KanbanClient[]; onMove: (id: string, col: Column) => void; onRefresh: () => void;
}) {
  const meta = COL_META[col];
  const [over, setOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (dragId) onMove(dragId, col);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: 1,
        minWidth: 280,
        maxWidth: 420,
        background: over ? `${meta.color}08` : 'rgba(0,0,0,0.01)',
        borderRadius: 12,
        padding: 16,
        border: `2px dashed ${over ? meta.color : 'transparent'}`,
        outline: `1px solid rgba(0,0,0,0.06)`,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
          {meta.title}
        </h2>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.06)', padding: '2px 10px', borderRadius: 12 }}>
          {clients.length}
        </span>
      </div>

      {/* Cards or empty state */}
      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 8 }}>
          {over ? 'Drop here' : 'All clear'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(c => (
            <KanbanCard key={c.id} client={c} onMove={onMove} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkloadKanbanPage() {
  const [clients, setClients] = useState<KanbanClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/career/admin/clients?kanban=true&pageSize=200&lifecycleStatus=ALL');
      if (res.ok) {
        const data = await res.json();
        const all: KanbanClient[] = (data.clients || []).filter(
          (c: KanbanClient) => c.status !== 'NOT_STARTED' && c.status !== 'COMPLETED'
        );
        setClients(all);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistic move (UI updates immediately, API call follows)
  const handleMove = useCallback(async (id: string, toCol: Column) => {
    const newWaitingOn = COL_META[toCol].waitingOn ?? 'AGENCY';
    setClients(prev => prev.map(c => c.id === id ? { ...c, waitingOn: newWaitingOn } : c));
    try {
      await fetch(`/api/career/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingOn: newWaitingOn }),
      });
    } catch { load(); } // rollback on error
  }, [load]);

  const filtered = filter
    ? clients.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.services.some(s => s.service.name.toLowerCase().includes(filter.toLowerCase()))
      )
    : clients;

  const byCol = (col: Column) => filtered.filter(c => clientColumn(c) === col);
  const slaBreached = clients.filter(c => c.slaDeadline && new Date(c.slaDeadline) < new Date()).length;

  return (
    <AppShell>
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Workload Kanban</h1>
            <p className="page-subtitle mt-1">Drag cards between columns or use the quick buttons.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {slaBreached > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#ef444412', border: '1px solid #ef444430', padding: '4px 12px', borderRadius: 99 }}>
                ⚠ {slaBreached} SLA breached
              </span>
            )}
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, width: 180, outline: 'none' }}
            />
            <button onClick={load} className="btn btn-ghost btn-sm">Refresh</button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            { label: 'My Queue',        count: byCol('AGENCY').length,  color: '#ef4444' },
            { label: 'Waiting Client',  count: byCol('CLIENT').length,  color: '#eab308' },
            { label: 'Other Active',    count: byCol('OTHER').length,   color: '#64748b' },
            { label: 'Total Active',    count: filtered.length,         color: '#B8935B' },
          ] as const).map(({ label, count, color }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 18px', minWidth: 100 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          /* Columns — horizontal scroll on mobile */
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 24, alignItems: 'flex-start', WebkitOverflowScrolling: 'touch' }}>
            <KanbanCol col="AGENCY" clients={byCol('AGENCY')} onMove={handleMove} onRefresh={load} />
            <KanbanCol col="CLIENT" clients={byCol('CLIENT')} onMove={handleMove} onRefresh={load} />
            {byCol('OTHER').length > 0 && (
              <KanbanCol col="OTHER" clients={byCol('OTHER')} onMove={handleMove} onRefresh={load} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
