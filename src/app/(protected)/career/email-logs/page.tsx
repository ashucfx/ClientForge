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
  metadata?: unknown;
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
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
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
      const res = await fetch(`/api/admin/career/sys-email-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSysLogs(data.logs);
        setSysTotal(data.pagination.total);
        setSysPage(p);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    loadStats();
    if (source === 'career') loadCareer(1);
    else loadSys(1);
    setExpandedId(null);
  }, [source, filter, loadCareer, loadSys, loadStats]);

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

  const total = source === 'career' ? careerTotal : sysTotal;
  const page  = source === 'career' ? careerPage : sysPage;
  const pages = Math.ceil(total / 50);
  const prevPage = () => source === 'career' ? loadCareer(careerPage - 1) : loadSys(sysPage - 1);
  const nextPage = () => source === 'career' ? loadCareer(careerPage + 1) : loadSys(sysPage + 1);
  const isEmpty  = source === 'career' ? careerLogs.length === 0 : sysLogs.length === 0;

  return (
    <AppShell>
      <div style={{ padding: '28px 32px', maxWidth: 1340, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Email Logs</h1>
            <p className="page-subtitle mt-1">
              {source === 'career'
                ? 'Career client lifecycle emails via Resend. Delete an entry to reset the trigger.'
                : 'Proposal, invoice, and admin alert emails via SMTP and Resend.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: source === 'career' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <StatCard label="Sent"   count={statsLoading ? null : stats.sent}   color="#10b981" />
          <StatCard label="Failed" count={statsLoading ? null : stats.failed} color="#ef4444" />
          {source === 'career' && (
            <StatCard label="Queued" count={statsLoading ? null : stats.queued} color="#f59e0b" />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {(['career', 'admin'] as Source[]).map(s => (
            <button
              key={s}
              onClick={() => { setSource(s); setFilter(''); }}
              style={{
                padding: '8px 18px',
                fontSize: 13, fontWeight: 600,
                borderRadius: '8px 8px 0 0',
                background: source === s ? 'var(--surface)' : 'transparent',
                color: source === s ? 'var(--brand)' : 'var(--text-secondary)',
                borderBottom: source === s ? '2px solid var(--brand)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {s === 'career' ? 'Career Emails (Resend)' : 'Admin Emails (SMTP/Resend)'}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 0', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          >
            <option value="">All statuses</option>
            <option value="sent">✓ Sent</option>
            <option value="failed">✗ Failed</option>
            {source === 'career' && <option value="queued">⏳ Queued</option>}
          </select>
          {filter && (
            <button onClick={() => setFilter('')} className="btn btn-ghost btn-sm">
              Clear filter
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {total.toLocaleString()} entries · page {page}
          </span>
        </div>

        {/* Flash message */}
        {msg && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: msg.ok ? '#10b98114' : '#ef444414',
            border: `1px solid ${msg.ok ? '#10b98130' : '#ef444430'}`,
            color: msg.ok ? '#10b981' : '#ef4444',
          }}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : isEmpty ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No email logs found</div>
            {filter && (
              <button onClick={() => setFilter('')} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>

            {/* ── Career logs ─────────────────────────────────────────── */}
            {source === 'career' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Resend ID</th>
                    <th>Sent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {careerLogs.map(log => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <>
                        <tr
                          key={log.id}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <Link
                              href={`/career/${log.client.id}`}
                              style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}
                              onClick={e => e.stopPropagation()}
                            >
                              {log.client.name}
                            </Link>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.client.email}</div>
                          </td>
                          <td><TriggerLabel trigger={log.trigger} /></td>
                          <td><StatusChip status={log.status} /></td>
                          <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                            {log.resendId ? (
                              <a
                                href={`https://resend.com/emails/${log.resendId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--brand)', textDecoration: 'none' }}
                                onClick={e => e.stopPropagation()}
                              >
                                {log.resendId.slice(0, 14)}…
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>cron guard</span>
                            )}
                          </td>
                          <td title={fullDate(log.sentAt)} style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', cursor: 'default' }}>
                            {relativeTime(log.sentAt)}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleResend(log.id)}
                                disabled={resending === log.id}
                                style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--brand-light,#b8935b30)', background: 'var(--brand-light,#b8935b10)', color: 'var(--brand)', cursor: 'pointer', opacity: resending === log.id ? 0.5 : 1 }}
                              >
                                {resending === log.id ? '…' : 'Resend'}
                              </button>
                              <button
                                onClick={() => handleDeleteCareer(log.id)}
                                disabled={deleting === log.id}
                                style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer', opacity: deleting === log.id ? 0.5 : 1 }}
                              >
                                {deleting === log.id ? '…' : 'Reset'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${log.id}-detail`} style={{ background: 'var(--surface)' }}>
                            <td colSpan={6} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Trigger</div>
                                  <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>{log.trigger}</code>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Sent At</div>
                                  <span style={{ color: 'var(--text-primary)' }}>{fullDate(log.sentAt)}</span>
                                </div>
                                {log.resendId && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Resend ID</div>
                                    <a href={`https://resend.com/emails/${log.resendId}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand)' }}>
                                      {log.resendId}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── Admin / SMTP logs ─────────────────────────────────────── */}
            {source === 'admin' && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Trigger</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {sysLogs.map(log => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <>
                        <tr key={log.id} onClick={() => setExpandedId(isExpanded ? null : log.id)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontSize: 13 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.to}</div>
                          </td>
                          <td style={{ fontSize: 12, maxWidth: 260 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.subject}
                            </span>
                            {log.error && (
                              <span style={{ fontSize: 10, color: '#ef4444', display: 'block', marginTop: 2 }}>
                                {log.error.slice(0, 80)}{log.error.length > 80 ? '…' : ''}
                              </span>
                            )}
                          </td>
                          <td><TriggerLabel trigger={log.trigger} /></td>
                          <td>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: log.channel === 'smtp' ? '#f59e0b14' : '#6366f114',
                              color: log.channel === 'smtp' ? '#d97706' : '#6366f1',
                            }}>
                              {log.channel.toUpperCase()}
                            </span>
                          </td>
                          <td><StatusChip status={log.status} /></td>
                          <td title={fullDate(log.sentAt)} style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', cursor: 'default' }}>
                            {relativeTime(log.sentAt)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${log.id}-detail`} style={{ background: 'var(--surface)' }}>
                            <td colSpan={6} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Recipient</div>
                                  <span>{log.to}</span>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Full Subject</div>
                                  <span>{log.subject}</span>
                                </div>
                                {log.error && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Error</div>
                                    <pre style={{ margin: 0, fontSize: 11, background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#991b1b', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                      {log.error}
                                    </pre>
                                  </div>
                                )}
                                {log.metadata != null && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Metadata</div>
                                    <pre style={{ margin: 0, fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
            <button onClick={prevPage} disabled={page <= 1} className="btn btn-ghost btn-sm">← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>Page {page} of {pages}</span>
            <button onClick={nextPage} disabled={page >= pages} className="btn btn-ghost btn-sm">Next →</button>
          </div>
        )}

      </div>
    </AppShell>
  );
}
