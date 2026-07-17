'use client';
// src/components/NotificationBell.tsx
// Admin notification bell — polls /api/career/admin/unread-summary every 60s.
// Displays badge count and dropdown with recent unread items.
// Zero schema changes — uses existing Notification model + readByAdmin booleans.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useBrand } from '@/components/BrandProvider';

interface UnreadClient {
  id: string;
  name: string;
  email: string;
  unreadCount: number;
  lastActivityAt: string;
  lastPreview: string;
  link?: string;
  isNotification?: boolean;
}

interface UnreadSummary {
  totalUnread: number;
  totalUnreadMessages: number;
  pendingRevisions: number;
  unreadNotifications: number;
  clientsWithUnread: UnreadClient[];
  recentNotifications?: any[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ direction = 'down', label }: { direction?: 'up' | 'down', label?: string }) {
  const { activeBrand } = useBrand();
  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine which API to poll based on active brand
  const careerEndpoint = '/api/career/admin/unread-summary';
  const rnEndpoint = '/api/rn/admin/unread-summary';

  // Tenant separation: only ever poll the ACTIVE brand's feed. A Ripple Nexus
  // session must never see (or request) Catalyst/career notifications.
  const isRnBrand = activeBrand === 'ripple_nexus';

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(isRnBrand ? rnEndpoint : careerEndpoint, { cache: 'no-store' });
      if (!res.ok) return;
      const data: UnreadSummary = await res.json();

      const allClients: UnreadClient[] = [...(data.clientsWithUnread ?? [])];
      if (data.recentNotifications) {
        allClients.push(...data.recentNotifications.map((n: any) => ({
          id: n.id,
          name: n.title,
          email: 'system',
          unreadCount: 1,
          lastActivityAt: n.createdAt,
          lastPreview: n.message,
          link: n.link || (isRnBrand ? '/rn/notifications' : '/notifications'),
          isNotification: true,
        })));
      }

      allClients.sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );

      setSummary({
        totalUnread: data.totalUnread ?? 0,
        totalUnreadMessages: data.totalUnreadMessages ?? 0,
        pendingRevisions: data.pendingRevisions ?? 0,
        unreadNotifications: data.unreadNotifications ?? 0,
        clientsWithUnread: allClients.slice(0, 8),
      });
    } catch {
      // Silently fail — badge just won't update
    }
  }, [isRnBrand]);

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      fetchSummary();
    } catch {
      // Ignore
    }
  };

  // Poll every 60 seconds
  useEffect(() => {
    fetchSummary();
    pollRef.current = setInterval(fetchSummary, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchSummary]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalBadge = (summary?.totalUnread ?? 0) + (summary?.unreadNotifications ?? 0);
  const isRn = activeBrand === 'ripple_nexus';
  const accentColor = isRn ? '#7C5CFF' : '#B8935B';

  return (
    <div ref={dropdownRef} style={label ? { position: 'relative', width: '100%' } : { position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchSummary(); }}
        aria-label={`Notifications${totalBadge > 0 ? ` (${totalBadge} unread)` : ''}`}
        className={label ? `nav-item${open ? ' active' : ''}` : ''}
        style={label ? {
          width: '100%',
          marginBottom: 6,
          justifyContent: 'flex-start',
        } : {
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 10,
          border: open ? `1.5px solid ${accentColor}40` : '1.5px solid transparent',
          background: open ? `${accentColor}10` : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          color: totalBadge > 0 ? accentColor : 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        <span className={label ? "nav-icon" : ""} style={{ position: 'relative', display: 'inline-flex', color: (label && totalBadge > 0) ? accentColor : undefined }}>
          {/* Bell icon */}
          <svg width={label ? "16" : "17"} height={label ? "16" : "17"} fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>

          {/* Badge */}
          {totalBadge > 0 && (
            <span style={{
              position: 'absolute',
              top: label ? -6 : -2,
              right: label ? -8 : -2,
            minWidth: 16,
            height: 16,
            padding: '0 3px',
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg, #fff)',
            lineHeight: 1,
            zIndex: 10,
          }}>
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
        </span>
        {label && <span style={{ flex: 1, textAlign: 'left', fontWeight: totalBadge > 0 ? 600 : 500, color: totalBadge > 0 ? accentColor : undefined }}>{label}</span>}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(direction === 'up' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
          ...(direction === 'up' ? { left: 0 } : { right: 0 }),
          width: 340,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'fadeInDown 0.15s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Activity & Notifications
            </span>
            {totalBadge > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px',
                background: '#fef2f2',
                color: '#dc2626',
                borderRadius: 999,
                border: '1px solid #fecaca',
              }}>
                {totalBadge} unread
              </span>
            )}
          </div>

          {/* Summary pills */}
          {summary && (summary.totalUnreadMessages > 0 || summary.pendingRevisions > 0) && (
            <div style={{
              padding: '10px 14px',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border, #f8fafc)',
              background: 'var(--surface-2, #fafbfc)',
            }}>
              {summary.totalUnreadMessages > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 10px',
                  background: `${accentColor}15`,
                  color: accentColor,
                  borderRadius: 999,
                  border: `1px solid ${accentColor}30`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, display: 'inline-block' }} />
                  {summary.totalUnreadMessages} message{summary.totalUnreadMessages !== 1 ? 's' : ''}
                </span>
              )}
              {summary.pendingRevisions > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 10px',
                  background: '#fff7ed',
                  color: '#c2410c',
                  borderRadius: 999,
                  border: '1px solid #fed7aa',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
                  {summary.pendingRevisions} revision{summary.pendingRevisions !== 1 ? 's' : ''} pending
                </span>
              )}
            </div>
          )}

          {/* Client list */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {!summary || summary.clientsWithUnread.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary, #94a3b8)', fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                All caught up
              </div>
            ) : (
              summary.clientsWithUnread.map(c => {
                const isSystem = c.email === 'system';
                const href = c.link || (isRn ? `/rn/clients/${c.id}` : `/career/${c.id}`);
                return (
                  <Link
                    key={c.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border, #f8fafc)',
                      textDecoration: 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3, #f8fafc)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Avatar or Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: isSystem ? 'var(--surface-3, #f1f5f9)' : accentColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSystem ? 'var(--text-secondary, #64748b)' : '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {isSystem ? (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        c.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {timeAgo(c.lastActivityAt)}
                        </span>
                      </div>
                      <p style={{
                        margin: '2px 0 0',
                        fontSize: 12,
                        color: 'var(--text-secondary, #64748b)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {c.lastPreview}
                      </p>
                    </div>
                    {/* Unread count pill or delete button */}
                    {c.isNotification ? (
                      <button
                        onClick={(e) => handleDeleteNotification(c.id, e)}
                        style={{
                          flexShrink: 0,
                          width: 24, height: 24,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-tertiary, #94a3b8)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary, #94a3b8)')}
                        title="Delete notification"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : c.unreadCount > 0 && (
                      <span style={{
                        flexShrink: 0,
                        minWidth: 20, height: 20,
                        padding: '0 5px',
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border, #f1f5f9)', padding: '10px 14px' }}>
            <Link
              href={isRn ? '/rn/inbox' : '/notifications'}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 12, fontWeight: 600, color: accentColor,
                textDecoration: 'none', display: 'block', textAlign: 'center',
              }}
            >
              {isRn ? 'Open inbox →' : 'View all notifications →'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
