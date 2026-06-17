'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

// ── Career emails (Resend, career lifecycle) ──────────────────────────────────
interface CareerLog {
  id: string;
  clientId: string;
  trigger: string;
  status: string;
  resendId: string | null;
  sentAt: string;
  client: { id: string; name: string; email: string };
}

// ── Admin/SMTP emails (proposals, invoices, alerts) ───────────────────────────
interface SysLog {
  id: string;
  to: string;
  subject: string;
  trigger: string;
  channel: string;
  status: string;
  error: string | null;
  sentAt: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  sent:   { bg: '#10b98114', color: '#10b981' },
  queued: { bg: '#f59e0b14', color: '#f59e0b' },
  failed: { bg: '#ef444414', color: '#ef4444' },
};

type Source = 'career' | 'admin';

export default function EmailLogsPage() {
  const [source, setSource]   = useState<Source>('career');
  const [filter, setFilter]   = useState('');

  const [careerLogs, setCareerLogs] = useState<CareerLog[]>([]);
  const [careerTotal, setCareerTotal] = useState(0);
  const [careerPage, setCareerPage] = useState(1);

  const [sysLogs, setSysLogs] = useState<SysLog[]>([]);
  const [sysTotal, setSysTotal] = useState(0);
  const [sysPage, setSysPage] = useState(1);

  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg]           = useState('');

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
    if (source === 'career') loadCareer(1);
    else loadSys(1);
  }, [source, filter, loadCareer, loadSys]);

  const handleDeleteCareer = async (id: string) => {
    if (!confirm('Delete this log entry? The email trigger will be re-sent on next cron run.')) return;
    setDeleting(id);
    try {
      await fetch('/api/admin/career/email-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setMsg('Log deleted — trigger reset');
      loadCareer(careerPage);
    } catch { setMsg('Failed to delete'); }
    finally { setDeleting(null); setTimeout(() => setMsg(''), 3000); }
  };

  const total = source === 'career' ? careerTotal : sysTotal;
  const page  = source === 'career' ? careerPage : sysPage;
  const pages = Math.ceil(total / 50);

  const prevPage = () => source === 'career' ? loadCareer(careerPage - 1) : loadSys(sysPage - 1);
  const nextPage = () => source === 'career' ? loadCareer(careerPage + 1) : loadSys(sysPage + 1);

  return (
    <AppShell>
      <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Email Logs</h1>
            <p className="page-subtitle mt-1">
              {source === 'career'
                ? 'Career client lifecycle emails via Resend. Delete an entry to reset that trigger for re-send.'
                : 'Proposal, invoice, and admin alert emails via SMTP and Resend.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}>
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              {source === 'career' && <option value="queued">Queued</option>}
            </select>
            <button onClick={() => source === 'career' ? loadCareer(1) : loadSys(1)} className="btn btn-ghost btn-sm">
              Refresh
            </button>
          </div>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {(['career', 'admin'] as Source[]).map(s => (
            <button
              key={s}
              onClick={() => { setSource(s); setFilter(''); }}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: '8px 8px 0 0',
                background: source === s ? 'var(--surface)' : 'transparent',
                color: source === s ? 'var(--brand)' : 'var(--text-secondary)',
                borderBottom: source === s ? '2px solid var(--brand)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {s === 'career' ? `Career Emails (Resend)` : `Admin Emails (SMTP/Resend)`}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#10b98114', border: '1px solid #10b98130', color: '#10b981', fontSize: 13, fontWeight: 600 }}>
            {msg}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          {total} log entries total · page {page}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* ── Career logs ── */}
            {source === 'career' && (
              careerLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>No email logs found.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Trigger</th>
                      <th>Status</th>
                      <th>Resend ID</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerLogs.map(log => {
                      const ss = STATUS_STYLE[log.status] ?? { bg: '#64748b14', color: '#64748b' };
                      return (
                        <tr key={log.id}>
                          <td>
                            <Link href={`/career/${log.client.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {log.client.name}
                            </Link>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.client.email}</div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.trigger}</span>
                            {!log.resendId && (
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>cron guard</div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: ss.bg, color: ss.color }}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                            {log.resendId ? log.resendId.slice(0, 16) + '…' : '—'}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            {log.sentAt ? new Date(log.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteCareer(log.id)}
                              disabled={deleting === log.id}
                              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}>
                              {deleting === log.id ? '…' : 'Reset'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* ── Admin / SMTP logs ── */}
            {source === 'admin' && (
              sysLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                  No admin email logs yet. Logs appear here after proposals or invoices are sent.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>To</th>
                      <th>Subject</th>
                      <th>Trigger</th>
                      <th>Channel</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sysLogs.map(log => {
                      const ss = STATUS_STYLE[log.status] ?? { bg: '#64748b14', color: '#64748b' };
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.to}</td>
                          <td style={{ fontSize: 12, maxWidth: 260 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.subject}
                            </span>
                            {log.error && (
                              <span style={{ fontSize: 10, color: '#ef4444', display: 'block', marginTop: 2 }}>{log.error}</span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.trigger}</td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                              background: log.channel === 'smtp' ? '#f59e0b14' : '#6366f114',
                              color: log.channel === 'smtp' ? '#d97706' : '#6366f1' }}>
                              {log.channel.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: ss.bg, color: ss.color }}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            {log.sentAt ? new Date(log.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
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
