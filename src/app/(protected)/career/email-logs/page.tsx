'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CareerLog {
  id: string;
  clientId: string;
  trigger: string;
  status: string;
  resendId: string | null;
  sentAt: string;
  client: { id: string; name: string; email: string };
}

interface SysLog {
  id: string;
  to: string;
  subject: string;
  trigger: string;
  channel: string;
  status: string;
  error: string | null;
  sentAt: string;
  metadata?: { invoiceId?: string; invoiceNumber?: string; source?: string; [key: string]: unknown } | null;
}

interface Stats { sent: number; failed: number; queued: number }

type Source = 'career' | 'admin';

// ── Label maps ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  WELCOME: 'Welcome',
  LOGIN_LINK: 'Login Link',
  FORM_CONFIRM: 'Form Submitted',
  DRAFT_READY: 'Draft Ready',
  LINKEDIN_DRAFT: 'LinkedIn Draft',
  REVISED_DRAFT: 'Revised Draft',
  FINAL_DELIVERY: 'Final Delivery',
  REVISION: 'Revision Update',
  LINKEDIN_SECURITY: 'LinkedIn Security',
  MESSAGE_NOTIFY: 'New Message',
  DELETE_OTP: 'Delete OTP',
  UPSELL_PITCH: 'Upsell',
  STALE_REMINDER: 'Stale Reminder',
  DRAFT_REMINDER: 'Draft Reminder',
  KEEP_WARM: 'Keep Warm',
  GHOST_WARNING: 'Ghost Warning',
  GHOST_CLOSURE: 'Ghost Closure',
  REVIEW_REQUEST: 'Review Request',
  REVISION_EXPIRING: 'Revision Expiring',
  PROPOSAL_SENT: 'Proposal Sent',
  INVOICE_SENT: 'Invoice Sent',
  INVOICE_RESENT: 'Invoice Resent',
  ADMIN_ALERT: 'Admin Alert',
  CAMPAIGN: 'Campaign',
};

const TRIGGER_CATEGORY: Record<string, { label: string; color: string }> = {
  WELCOME: { label: 'Lifecycle', color: '#6366f1' },
  LOGIN_LINK: { label: 'Auth', color: '#8b5cf6' },
  FORM_CONFIRM: { label: 'Lifecycle', color: '#6366f1' },
  DRAFT_READY: { label: 'Delivery', color: '#0891b2' },
  LINKEDIN_DRAFT: { label: 'Delivery', color: '#0891b2' },
  REVISED_DRAFT: { label: 'Delivery', color: '#0891b2' },
  FINAL_DELIVERY: { label: 'Delivery', color: '#0891b2' },
  REVISION: { label: 'Lifecycle', color: '#6366f1' },
  LINKEDIN_SECURITY: { label: 'Auth', color: '#8b5cf6' },
  MESSAGE_NOTIFY: { label: 'Comms', color: '#7c3aed' },
  DELETE_OTP: { label: 'Auth', color: '#8b5cf6' },
  UPSELL_PITCH: { label: 'Sales', color: '#b8935b' },
  STALE_REMINDER: { label: 'Auto', color: '#64748b' },
  DRAFT_REMINDER: { label: 'Auto', color: '#64748b' },
  KEEP_WARM: { label: 'Auto', color: '#64748b' },
  GHOST_WARNING: { label: 'Auto', color: '#64748b' },
  GHOST_CLOSURE: { label: 'Auto', color: '#64748b' },
  REVIEW_REQUEST: { label: 'Auto', color: '#64748b' },
  REVISION_EXPIRING: { label: 'Auto', color: '#64748b' },
  PROPOSAL_SENT: { label: 'Sales', color: '#b8935b' },
  INVOICE_SENT: { label: 'Billing', color: '#10b981' },
  INVOICE_RESENT: { label: 'Billing', color: '#10b981' },
  ADMIN_ALERT: { label: 'Admin', color: '#ef4444' },
  CAMPAIGN: { label: 'Marketing', color: '#f59e0b' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fullDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
}

function exactDateTime(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: '—', time: '' };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
  };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { icon: string; color: string; bg: string }> = {
    sent:   { icon: '✓', color: '#10b981', bg: '#10b98114' },
    queued: { icon: '⏳', color: '#f59e0b', bg: '#f59e0b14' },
    failed: { icon: '✗', color: '#ef4444', bg: '#ef444414' },
  };
  const s = map[status] ?? { icon: '·', color: '#64748b', bg: '#64748b14' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700,
      padding: '3px 9px', borderRadius: 99,
      background: s.bg, color: s.color,
    }}>
      {s.icon} {status.toUpperCase()}
    </span>
  );
}

function TriggerLabel({ trigger }: { trigger: string }) {
  const label = TRIGGER_LABELS[trigger] ?? trigger.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const cat = TRIGGER_CATEGORY[trigger];
  return (
    <div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      {cat && (
        <span style={{
          marginLeft: 6, fontSize: 10, fontWeight: 700,
          padding: '1px 7px', borderRadius: 99,
          background: `${cat.color}18`, color: cat.color,
        }}>
          {cat.label}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number | null; color: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 4,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: count === null ? 'var(--text-tertiary)' : color }}>
        {count === null ? '…' : count.toLocaleString()}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const [source, setSource]   = useState<Source>('career');
  const [filter, setFilter]   = useState('');

  const [careerLogs, setCareerLogs] = useState<CareerLog[]>([]);
  const [careerTotal, setCareerTotal] = useState(0);
  const [careerPage, setCareerPage] = useState(1);

  const [sysLogs, setSysLogs] = useState<SysLog[]>([]);
  const [sysTotal, setSysTotal] = useState(0);
  const [sysPage, setSysPage] = useState(1);

  const [stats, setStats]         = useState<Stats>({ sent: 0, failed: 0, queued: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [syncing, setSyncing]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggerFilter, setTriggerFilter] = useState('');
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  // Load stats (counts per status)
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const base = source === 'career' ? '/api/admin/career/email-logs' : '/api/admin/career/sys-email-logs';
      const [s, f, q] = await Promise.all([
        fetch(`${base}?page=1&status=sent`).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch(`${base}?page=1&status=failed`).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        source === 'career'
          ? fetch(`${base}?page=1&status=queued`).then(r => r.json()).catch(() => ({ pagination: { total: 0 } }))
          : Promise.resolve({ pagination: { total: 0 } }),
      ]);
      setStats({
        sent:   s.pagination?.total ?? 0,
        failed: f.pagination?.total ?? 0,
        queued: q.pagination?.total ?? 0,
      });
    } finally { setStatsLoading(false); }
  }, [source]);

  const loadCareer = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/admin/career/email-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCareerLogs(data.logs);
        setCareerTotal(data.pagination.total);
        setCareerPage(p);
      }
    } finally { setLoading(false); }
  }, [filter]);

  const loadSys = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter) params.set('status', filter);
      if (triggerFilter) params.set('trigger', triggerFilter);
      const res = await fetch(`/api/admin/career/sys-email-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSysLogs(data.logs);
        setSysTotal(data.pagination.total);
        setSysPage(p);
      }
    } finally { setLoading(false); }
  }, [filter, triggerFilter]);

  useEffect(() => {
    loadStats();
    if (source === 'career') loadCareer(1);
    else loadSys(1);
    setExpandedId(null);
  }, [source, filter, triggerFilter, loadCareer, loadSys, loadStats]);

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  const handleDeleteCareer = async (id: string) => {
    if (!confirm('Delete this log entry? The email trigger will be re-sent on next cron run.')) return;
    setDeleting(id);
    try {
      await fetch('/api/admin/career/email-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      flash('Log deleted — trigger reset');
      loadCareer(careerPage);
      loadStats();
    } catch { flash('Failed to delete', false); }
    finally { setDeleting(null); }
  };

  const handleDeleteSys = async (id: string) => {
    if (!confirm('Delete this log entry?')) return;
    setDeleting(id);
    try {
      await fetch('/api/admin/career/sys-email-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      flash('Log deleted');
      loadSys(sysPage);
      loadStats();
    } catch { flash('Failed to delete', false); }
    finally { setDeleting(null); }
  };

  const handleResend = async (id: string) => {
    setResending(id);
    try {
      const res = await fetch('/api/admin/career/email-logs/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        flash('Email re-dispatched successfully');
        loadCareer(careerPage);
      } else {
        flash(data.error ?? 'Resend failed', false);
      }
    } catch { flash('Resend failed', false); }
    finally { setResending(null); }
  };

  // Compute send frequency per invoiceId from current page data
  const invoiceSendCounts = sysLogs.reduce<Record<string, number>>((acc, log) => {
    const id = log.metadata?.invoiceId;
    if (id) acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  const total = source === 'career' ? careerTotal : sysTotal;
  const page  = source === 'career' ? careerPage : sysPage;
  const pages = Math.ceil(total / 50);
  const prevPage = () => source === 'career' ? loadCareer(careerPage - 1) : loadSys(sysPage - 1);
  const nextPage = () => source === 'career' ? loadCareer(careerPage + 1) : loadSys(sysPage + 1);
  const isEmpty  = source === 'career' ? careerLogs.length === 0 : sysLogs.length === 0;

  const btnSm = 'text-[11px] font-semibold px-2.5 py-1 rounded-md border cursor-pointer transition-opacity disabled:opacity-50';

  return (
    <AppShell>
      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 max-w-[1340px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="page-title">Email Logs</h1>
            <p className="page-subtitle mt-1 text-xs sm:text-sm">
              {source === 'career'
                ? 'Career lifecycle emails via Resend. Delete an entry to reset the trigger.'
                : 'Invoice, proposal, and admin emails via SMTP/Resend.'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {source === 'career' && (
              <button
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const res = await fetch('/api/admin/career/email-logs/sync', { method: 'POST' });
                    const data = await res.json();
                    flash(data.synced > 0
                      ? `Synced ${data.synced} Resend ID${data.synced > 1 ? 's' : ''}`
                      : data.message ?? 'Nothing to sync');
                    loadCareer(careerPage);
                  } catch { flash('Sync failed', false); }
                  finally { setSyncing(false); }
                }}
                disabled={syncing}
                className="btn btn-ghost btn-sm"
                style={{ opacity: syncing ? 0.6 : 1 }}
              >
                {syncing ? 'Syncing…' : 'Sync IDs'}
              </button>
            )}
            <button onClick={() => source === 'career' ? loadCareer(1) : loadSys(1)} className="btn btn-ghost btn-sm">
              Refresh
            </button>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className={`grid gap-3 mb-5 ${source === 'career' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <StatCard label="Sent"   count={statsLoading ? null : stats.sent}   color="#10b981" />
          <StatCard label="Failed" count={statsLoading ? null : stats.failed} color="#ef4444" />
          {source === 'career' && (
            <StatCard label="Queued" count={statsLoading ? null : stats.queued} color="#f59e0b" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-0">
          {(['career', 'admin'] as Source[]).map(s => (
            <button key={s}
              onClick={() => { setSource(s); setFilter(''); setTriggerFilter(''); }}
              className={`px-3 sm:px-5 py-2 text-xs sm:text-[13px] font-semibold rounded-t-lg transition-colors ${
                source === s
                  ? 'bg-white text-[#B8935B] border-b-2 border-[#B8935B] -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="hidden sm:inline">{s === 'career' ? 'Career Emails (Resend)' : 'Admin Emails (SMTP/Resend)'}</span>
              <span className="sm:hidden">{s === 'career' ? 'Career' : 'Admin'}</span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 py-3 border-b border-slate-100 mb-4">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:outline-none focus:border-[#B8935B]">
            <option value="">All statuses</option>
            <option value="sent">✓ Sent</option>
            <option value="failed">✗ Failed</option>
            {source === 'career' && <option value="queued">⏳ Queued</option>}
          </select>
          {source === 'admin' && (
            <select value={triggerFilter} onChange={e => setTriggerFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs focus:outline-none focus:border-[#B8935B]">
              <option value="">All types</option>
              <option value="INVOICE_SENT">Invoice Sent</option>
              <option value="INVOICE_RESENT">Invoice Resent</option>
              <option value="PROPOSAL_SENT">Proposal Sent</option>
              <option value="ADMIN_ALERT">Admin Alert</option>
              <option value="CAMPAIGN">Campaign</option>
            </select>
          )}
          {(filter || triggerFilter) && (
            <button onClick={() => { setFilter(''); setTriggerFilter(''); }}
              className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 self-center">{total.toLocaleString()} entries · p{page}</span>
        </div>

        {/* Flash message */}
        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-semibold border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
        ) : isEmpty ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-3xl mb-3">📭</div>
            <div className="text-sm font-semibold mb-1">No email logs found</div>
            {(filter || triggerFilter) && (
              <button onClick={() => { setFilter(''); setTriggerFilter(''); }} className="mt-3 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Career logs ──────────────────────────────────────────── */}
            {source === 'career' && (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {careerLogs.map(log => {
                    const isExp = expandedId === log.id;
                    return (
                      <div key={log.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <button className="w-full text-left p-4" onClick={() => setExpandedId(isExp ? null : log.id)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link href={`/career/${log.client.id}`} onClick={e => e.stopPropagation()}
                                className="font-semibold text-slate-900 text-sm hover:text-indigo-600">
                                {log.client.name}
                              </Link>
                              <div className="text-xs text-slate-400 truncate">{log.client.email}</div>
                            </div>
                            <StatusChip status={log.status} />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <TriggerLabel trigger={log.trigger} />
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">{relativeTime(log.sentAt)}</span>
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100 space-y-3">
                            <div className="text-xs text-slate-500 mt-3">
                              <span className="font-semibold text-slate-700">Sent:</span> {fullDate(log.sentAt)}
                            </div>
                            {log.resendId && (
                              <div className="text-xs">
                                <span className="font-semibold text-slate-700 block mb-1">Resend ID</span>
                                <a href={`https://resend.com/emails/${log.resendId}`} target="_blank" rel="noopener noreferrer"
                                  className="font-mono text-[#B8935B] break-all">{log.resendId}</a>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => handleResend(log.id)} disabled={resending === log.id}
                                className={`${btnSm} border-[#b8935b30] bg-[#b8935b10] text-[#B8935B]`}>
                                {resending === log.id ? '…' : 'Resend'}
                              </button>
                              <button onClick={() => handleDeleteCareer(log.id)} disabled={deleting === log.id}
                                className={`${btnSm} border-red-200 bg-red-50 text-red-600`}>
                                {deleting === log.id ? '…' : 'Reset'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="data-table">
                    <thead><tr>
                      <th>Client</th><th>Trigger</th><th>Status</th><th>Resend ID</th><th>Sent</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                      {careerLogs.map(log => {
                        const isExp = expandedId === log.id;
                        return (
                          <>
                            <tr key={log.id} onClick={() => setExpandedId(isExp ? null : log.id)} style={{ cursor: 'pointer' }}>
                              <td>
                                <Link href={`/career/${log.client.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }} onClick={e => e.stopPropagation()}>{log.client.name}</Link>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.client.email}</div>
                              </td>
                              <td><TriggerLabel trigger={log.trigger} /></td>
                              <td><StatusChip status={log.status} /></td>
                              <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                {log.resendId
                                  ? <a href={`https://resend.com/emails/${log.resendId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{log.resendId.slice(0, 14)}…</a>
                                  : <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>cron guard</span>}
                              </td>
                              <td title={fullDate(log.sentAt)} style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{relativeTime(log.sentAt)}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => handleResend(log.id)} disabled={resending === log.id} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #b8935b30', background: '#b8935b10', color: 'var(--brand)', cursor: 'pointer', opacity: resending === log.id ? 0.5 : 1 }}>{resending === log.id ? '…' : 'Resend'}</button>
                                  <button onClick={() => handleDeleteCareer(log.id)} disabled={deleting === log.id} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer', opacity: deleting === log.id ? 0.5 : 1 }}>{deleting === log.id ? '…' : 'Reset'}</button>
                                </div>
                              </td>
                            </tr>
                            {isExp && (
                              <tr key={`${log.id}-d`} style={{ background: 'var(--surface)' }}>
                                <td colSpan={6} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                                    <div><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Trigger</div><code style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.trigger}</code></div>
                                    <div><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Sent At</div><span>{fullDate(log.sentAt)}</span></div>
                                    {log.resendId && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Resend ID</div><a href={`https://resend.com/emails/${log.resendId}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand)' }}>{log.resendId}</a></div>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Admin / SMTP logs ─────────────────────────────────────── */}
            {source === 'admin' && (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {sysLogs.map(log => {
                    const isExp = expandedId === log.id;
                    const dt = exactDateTime(log.sentAt);
                    const invoiceId = log.metadata?.invoiceId;
                    const sendCount = invoiceId ? (invoiceSendCounts[invoiceId] ?? 1) : 1;
                    return (
                      <div key={log.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <button className="w-full text-left p-4" onClick={() => setExpandedId(isExp ? null : log.id)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-sm truncate">{log.to}</div>
                              <div className="text-xs text-slate-400 truncate mt-0.5">{log.subject}</div>
                            </div>
                            <StatusChip status={log.status} />
                          </div>
                          <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <TriggerLabel trigger={log.trigger} />
                              {sendCount > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">✉ {sendCount}×</span>}
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] font-medium text-slate-700">{dt.date}</div>
                              <div className="text-[10px] text-slate-400">{dt.time}</div>
                            </div>
                          </div>
                          {log.error && <div className="mt-1.5 text-[10px] text-red-500 truncate">{log.error.slice(0, 80)}</div>}
                        </button>
                        {isExp && (
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100 space-y-3">
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div><span className="font-semibold text-slate-600 block mb-0.5">Channel</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.channel === 'smtp' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>{log.channel.toUpperCase()}</span>
                              </div>
                              <div><span className="font-semibold text-slate-600 block mb-0.5">Send Frequency</span>
                                <span>{sendCount}× {log.metadata?.source ? `(${log.metadata.source})` : ''}</span>
                              </div>
                            </div>
                            {log.error && (
                              <div className="text-xs">
                                <span className="font-semibold text-red-600 block mb-1">Error</span>
                                <pre className="text-[10px] bg-red-50 text-red-800 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">{log.error}</pre>
                              </div>
                            )}
                            {log.metadata != null && (
                              <div className="text-xs">
                                <span className="font-semibold text-slate-600 block mb-1">Metadata</span>
                                <pre className="text-[10px] bg-slate-50 border border-slate-200 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                              </div>
                            )}
                            <button onClick={() => handleDeleteSys(log.id)} disabled={deleting === log.id}
                              className={`${btnSm} border-red-200 bg-red-50 text-red-600`}>
                              {deleting === log.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="data-table">
                    <thead><tr><th>To</th><th>Subject</th><th>Trigger</th><th>Channel</th><th>Status</th><th>Sent At</th><th>Actions</th></tr></thead>
                    <tbody>
                      {sysLogs.map(log => {
                        const isExp = expandedId === log.id;
                        const dt = exactDateTime(log.sentAt);
                        const invoiceId = log.metadata?.invoiceId;
                        const sendCount = invoiceId ? (invoiceSendCounts[invoiceId] ?? 1) : 1;
                        return (
                          <>
                            <tr key={log.id} onClick={() => setExpandedId(isExp ? null : log.id)} style={{ cursor: 'pointer' }}>
                              <td style={{ fontSize: 13 }}><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.to}</div></td>
                              <td style={{ fontSize: 12, maxWidth: 260 }}>
                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.subject}</span>
                                {log.error && <span style={{ fontSize: 10, color: '#ef4444', display: 'block', marginTop: 2 }}>{log.error.slice(0, 80)}{log.error.length > 80 ? '…' : ''}</span>}
                              </td>
                              <td>
                                <TriggerLabel trigger={log.trigger} />
                                {sendCount > 1 && <div style={{ marginTop: 3 }}><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#fef3c714', color: '#d97706', border: '1px solid #fde68a' }}>✉ {sendCount}× sent</span></div>}
                              </td>
                              <td><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: log.channel === 'smtp' ? '#f59e0b14' : '#6366f114', color: log.channel === 'smtp' ? '#d97706' : '#6366f1' }}>{log.channel.toUpperCase()}</span></td>
                              <td><StatusChip status={log.status} /></td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{dt.date}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{dt.time}</div>
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleDeleteSys(log.id)} disabled={deleting === log.id} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer', opacity: deleting === log.id ? 0.5 : 1 }}>{deleting === log.id ? '…' : 'Delete'}</button>
                              </td>
                            </tr>
                            {isExp && (
                              <tr key={`${log.id}-d`} style={{ background: 'var(--surface)' }}>
                                <td colSpan={7} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                                    <div><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Recipient</div><span>{log.to}</span></div>
                                    <div><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Sent At (exact)</div><span style={{ fontWeight: 600 }}>{fullDate(log.sentAt)}</span><div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{relativeTime(log.sentAt)}</div></div>
                                    <div><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Send Frequency</div><span style={{ fontWeight: 600 }}>{sendCount}× sent</span>{log.metadata?.source && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>via {log.metadata.source}</div>}</div>
                                    <div style={{ gridColumn: '1 / -1' }}><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Subject</div><span>{log.subject}</span></div>
                                    {log.error && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontWeight: 700, color: '#ef4444', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Error</div><pre style={{ margin: 0, fontSize: 11, background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#991b1b', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{log.error}</pre></div>}
                                    {log.metadata != null && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Metadata</div><pre style={{ margin: 0, fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.metadata, null, 2)}</pre></div>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={prevPage} disabled={page <= 1} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 bg-white">← Prev</button>
            <span className="text-xs text-slate-400">Page {page} of {pages}</span>
            <button onClick={nextPage} disabled={page >= pages} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 bg-white">Next →</button>
          </div>
        )}

      </div>
    </AppShell>
  );
}
