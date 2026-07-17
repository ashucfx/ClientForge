'use client';
// src/components/shells/RippleNexusShell.tsx
// Dedicated shell for Ripple Nexus B2B operations — v2 Premium
// NO conditionals, NO Catalyst contamination.

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconGrid, IconList, IconLogout, IconTarget, IconUser, IconHome,
  IconFolder, IconInbox, IconTrendUp, IconMail, IconCalendar,
} from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { useAdmin } from '@/components/AdminProvider';
import NotificationBell from '@/components/NotificationBell';
import '@/app/(protected)/rn/rn.css';

// Retainer icon (SVG inline — not in Icons yet)
function IconRefresh({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

const RN_NAV = [
  { href: '/rn/dashboard',    Icon: IconHome,      label: 'Overview',            section: 'Workspace' },
  { href: '/rn/projects',     Icon: IconFolder,    label: 'Projects',            section: 'Workspace' },
  { href: '/rn/inbox',        Icon: IconInbox,     label: 'Inbox',               section: 'Workspace' },
  { href: '/rn/calendar',     Icon: IconCalendar,  label: 'Calendar',            section: 'Workspace' },

  { href: '/rn/clients',      Icon: IconUser,      label: 'Clients',             section: 'Operations' },
  { href: '/rn/retainers',    Icon: IconRefresh,   label: 'Retainers',           section: 'Operations' },
  { href: '/rn/services',     Icon: IconTarget,    label: 'Service Workflows',   section: 'Operations' },
  { href: '/rn/deliverables', Icon: IconGrid,      label: 'Global Deliverables', section: 'Operations' },
  { href: '/rn/invoices',     Icon: IconList,      label: 'Billing',             section: 'Operations' },
  { href: '/rn/emails',       Icon: IconMail,      label: 'Email Center',        section: 'Operations' },
  { href: '/rn/reports',      Icon: IconTrendUp,   label: 'Reports',             section: 'Operations' },
];

function isNavActive(href: string, pathname: string) {
  if (href === '/rn/invoices/new') return pathname === '/rn/invoices/new';
  if (href === '/rn/invoices') return pathname.startsWith('/rn/invoices') && pathname !== '/rn/invoices/new';
  return pathname.startsWith(href);
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px',
      background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
      borderRadius: 999, display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Polls the RN unread summary so the Inbox item carries a live badge. */
function useRnUnread() {
  const [unread, setUnread] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/rn/admin/unread-summary', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUnread(Number(data?.totalUnread) || 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll]);

  return unread;
}

export function RippleNexusShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const pathname = usePathname();
  const { hasCatalystAccess, adminId, role } = useAdmin();
  const unread = useRnUnread();

  // Workspace sections collapsed state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (s: string) => setCollapsed(p => ({ ...p, [s]: !p[s] }));

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  const handleSwitchToCatalyst = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: 'catalyst' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
    } catch { /* ignore */ }
    setSwitching(false);
  };

  const adminInitial = adminId.charAt(0).toUpperCase();
  const adminRole = role ?? 'ADMIN';

  const SidebarContent = () => (
    <>
      {/* Brand logo */}
      <div className="sidebar-logo">
        <Link href="/rn/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label="Ripple Nexus">
          <Logo variant="horizontal" size={36} brandId="ripple_nexus" dark={true} />
        </Link>
        <div className="sidebar-brand-pill">
          <span className="sidebar-brand-dot" />
          LIVE
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {(['Workspace', 'Operations'] as const).map(section => {
          const items = RN_NAV.filter(n => n.section === section);
          const isCollapsed = collapsed[section];
          return (
            <div key={section}>
              <button
                className="nav-section-label"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', padding: '16px 10px 6px',
                }}
                onClick={() => toggleSection(section)}
              >
                <span>{section}</span>
                <svg
                  width={10} height={10} viewBox="0 0 10 10" fill="none"
                  style={{ color: 'var(--text-tertiary)', transition: 'transform 200ms var(--ease)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {!isCollapsed && items.map(({ href, Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item${isNavActive(href, pathname) ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-icon"><Icon size={16} /></span>
                  {label}
                  {href === '/rn/inbox' && <UnreadBadge count={unread} />}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Admin avatar row */}
        <div className="sidebar-avatar-row">
          <div className="sidebar-avatar">{adminInitial}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Admin
            </div>
            <div className="sidebar-user-role">{adminRole.replace('_', ' ')}</div>
          </div>
        </div>

        <NotificationBell direction="up" label="Notifications" />
        {hasCatalystAccess && (
          <button className="nav-item" onClick={handleSwitchToCatalyst} disabled={switching} style={{ marginBottom: 2, width: '100%' }}>
            <span className="nav-icon" style={{ display: 'inline-flex' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden>
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3L4 7l4 4" /><path d="M4 7h16" />
                  <path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
                </g>
              </svg>
            </span>
            {switching ? 'Switching…' : 'Switch to Catalyst'}
          </button>
        )}
        <button className="nav-item" onClick={handleLogout} style={{ marginBottom: 4, width: '100%', color: 'var(--danger)' }}>
          <span className="nav-icon" style={{ display: 'inline-flex' }}>
            <IconLogout size={16} />
          </span>
          Logout
        </button>
        <span className="sidebar-version">ClientForge · B2B Agency v2</span>
      </div>
    </>
  );

  return (
    <div
      data-tenant="ripple_nexus"
      style={{ minHeight: '100vh' } as React.CSSProperties}
    >
      {/* ── Overlay (mobile) ── */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,14,0.7)', backdropFilter: 'blur(4px)', zIndex: 39 }}
        />
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="sidebar desktop-sidebar">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer ── */}
      <aside className={`sidebar mobile-drawer${open ? ' mobile-drawer-open' : ''}`}>
        <SidebarContent />
      </aside>

      {/* ── Mobile topbar ── */}
      <header className="mobile-topbar">
        <button
          className={`hamburger${open ? ' hamburger-open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>
        <div className="topbar-logo">
          <Logo variant="horizontal" size={30} brandId="ripple_nexus" dark={true} />
        </div>
        <div style={{ width: 44 }} />
      </header>

      {/* ── Content ── */}
      <div className="page-wrapper">
        {children}
      </div>
    </div>
  );
}
