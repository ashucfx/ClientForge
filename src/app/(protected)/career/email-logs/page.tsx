'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface EmailLog {
  id: string;
  clientId: string;
  trigger: string;
  status: string;
  resendId: string | null;
  createdAt: string;
  client: { id: string; name: string; email: string };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  sent:   { bg: '#10b98114', color: '#10b981' },
  queued: { bg: '#f59e0b14', color: '#f59e0b' },
  failed: { bg: '#ef444414', color: '#ef4444' },
};

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/admin/career/email-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.pagination.total);
        setPage(p);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(1); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this log entry? The email trigger will be re-sent on next cron run.')) return;
    setDeleting(id);
    try {
      await fetch('/api/admin/career/email-logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      setMsg('Log deleted — trigger reset');
      load(page);
    } catch { setMsg('Failed to delete'); }
    finally { setDeleting(null); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <AppShell>
      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Career Email Logs</h1>
            <p className="page-subtitle mt-1">
              View all lifecycle emails. Delete a log entry to reset the trigger so the email can be re-sent.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none' }}>
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="queued">Queued (stuck)</option>
              <option value="failed">Failed</option>
            </select>
            <button onClick={() => load(1)} className="btn btn-ghost btn-sm">Refresh</button>
          </div>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#10b98114', border: '1px solid #10b98130', color: '#10b981', fontSize: 13, fontWeight: 600 }}>
            {msg}
          </div>
        )}

        {/* Summary */}
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          {total} log entries total · page {page}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 12 }}>
            No email logs found.
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
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
                {logs.map(log => {
                  const ss = STATUS_STYLE[log.status] ?? { bg: '#64748b14', color: '#64748b' };
                  return (
                    <tr key={log.id}>
                      <td>
                        <Link href={`/career/${log.client.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {log.client.name}
                        </Link>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.client.email}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.trigger}</td>
                      <td>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: ss.bg, color: ss.color }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                        {log.resendId ? log.resendId.slice(0, 16) + '…' : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deleting === log.id}
                          title="Delete to reset trigger"
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #ef444430', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}>
                          {deleting === log.id ? '…' : 'Reset'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="btn btn-ghost btn-sm">← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>Page {page} of {Math.ceil(total / 50)}</span>
            <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 50)} className="btn btn-ghost btn-sm">Next →</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
