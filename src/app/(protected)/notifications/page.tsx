'use client';
// src/app/(protected)/notifications/page.tsx
// Admin notification center — shows all in-app notifications from DB
// Reads from existing Notification model — zero schema changes

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type NotifType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; bg: string; color: string; label: string }> = {
  INFO:    { icon: '💬', bg: '#eff6ff', color: '#1d4ed8', label: 'Message' },
  WARNING: { icon: '⚠️', bg: '#fff7ed', color: '#c2410c', label: 'Revision' },
  SUCCESS: { icon: '✅', bg: '#f0fdf4', color: '#15803d', label: 'Success' },
  ERROR:   { icon: '🚨', bg: '#fef2f2', color: '#dc2626', label: 'Alert' },
};

const TABS = ['All', 'Message', 'Revision', 'Success', 'Alert'] as const;
type Tab = typeof TABS[number];

function tabToTypes(tab: Tab): NotifType[] | null {
  if (tab === 'All')      return null;
  if (tab === 'Message')  return ['INFO'];
  if (tab === 'Revision') return ['WARNING'];
  if (tab === 'Success')  return ['SUCCESS'];
  if (tab === 'Alert')    return ['ERROR'];
  return null;
}

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<Notif[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('All');
  const [markingRead, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markAllRead = async () => {
    setMarking(true);
    await fetch('/api/admin/notifications', { method: 'PATCH' });
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setMarking(false);
  };

  const types = tabToTypes(tab);
  const visible = types ? notifs.filter(n => types.includes(n.type)) : notifs;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <AppShell>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={markAllRead}
              disabled={markingRead}
            >
              {markingRead ? 'Marking…' : '✓ Mark all read'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const count = t === 'All' ? unreadCount :
              notifs.filter(n => !n.isRead && tabToTypes(t)?.includes(n.type)).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: tab === t ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                  background: tab === t ? 'var(--brand)' : 'var(--surface-2)',
                  color: tab === t ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {t}
                {count > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, padding: '0 3px',
                    background: tab === t ? 'rgba(255,255,255,0.25)' : '#ef4444',
                    color: '#fff', fontSize: 9, fontWeight: 700,
                    borderRadius: 999, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 13, width: '45%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 11, width: '70%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No {tab === 'All' ? '' : tab.toLowerCase()} notifications
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                {tab === 'All'
                  ? 'Activity will appear here as clients interact with their portals.'
                  : `Switch to "All" to see other notifications.`}
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visible.map((n, idx) => {
                const cfg = TYPE_CONFIG[n.type];
                return (
                  <li
                    key={n.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 20px',
                      borderBottom: idx < visible.length - 1 ? '1px solid var(--border)' : 'none',
                      background: n.isRead ? 'transparent' : cfg.bg,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: cfg.bg, border: `1px solid ${cfg.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>
                      {cfg.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{
                          fontSize: 13, fontWeight: n.isRead ? 500 : 700,
                          color: 'var(--text-primary)', margin: 0,
                        }}>
                          {n.title}
                        </p>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 12, color: 'var(--text-secondary)',
                        margin: '3px 0 0', lineHeight: 1.5,
                      }}>
                        {n.message}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {!n.isRead && (
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#ef4444', flexShrink: 0,
                        }} />
                      )}
                      {n.link && (
                        <Link
                          href={n.link}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}
                        >
                          View →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && notifs.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12 }}>
            Showing last {notifs.length} notifications
          </p>
        )}
      </div>
    </AppShell>
  );
}
