'use client';
// src/components/AppShell.tsx
// Shared responsive shell: sidebar on desktop, drawer + topbar on mobile

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconGrid, IconPlus, IconList, IconLogout, IconTarget, IconUser, IconLink } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { useBrand } from '@/components/BrandProvider';
import { useAdmin } from '@/components/AdminProvider';
import NotificationBell from '@/components/NotificationBell';


const NAV_MAIN = [
  { href: '/',             Icon: IconGrid, label: 'Dashboard'    },
  { href: '/invoices/new', Icon: IconPlus, label: 'New Invoice'  },
  { href: '/invoices',     Icon: IconList, label: 'All Invoices' },
  { href: '/team',         Icon: IconUser, label: 'Team & Access' },
];


const NAV_CAREER = [
  { href: '/career', Icon: IconTarget, label: 'Career Booster Services' },
];

const NAV_RN = [
  { href: '/rn/clients', Icon: IconUser, label: 'Agency Clients' },
  { href: '/rn/services', Icon: IconTarget, label: 'Service Modules' },
];

function isNavActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href === '/invoices/new') return pathname === '/invoices/new';
  if (href === '/invoices') return pathname.startsWith('/invoices') && pathname !== '/invoices/new';
  if (href === '/career') return pathname.startsWith('/career');
  if (href === '/rn/clients') return pathname.startsWith('/rn/clients');
  if (href === '/rn/services') return pathname.startsWith('/rn/services');
  return pathname.startsWith(href);
}


// ── Unread summary hook (60s polling, schema-free) ─────────────────────────
interface UnreadSummary {
  totalUnread: number;
  totalUnreadMessages: number;
  pendingRevisions: number;
}

function useUnreadSummary() {
  const [careerUnread, setCareerUnread] = useState(0);
  const [rnUnread, setRnUnread] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const [c, r] = await Promise.allSettled([
        fetch('/api/career/admin/unread-summary', { cache: 'no-store' }),
        fetch('/api/rn/admin/unread-summary', { cache: 'no-store' }),
      ]);
      if (c.status === 'fulfilled' && c.value.ok) {
        const d: UnreadSummary = await c.value.json();
        setCareerUnread(d.totalUnread);
      }
      if (r.status === 'fulfilled' && r.value.ok) {
        const d: UnreadSummary = await r.value.json();
        setRnUnread(d.totalUnread);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetch_();
    pollRef.current = setInterval(fetch_, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetch_]);

  return { careerUnread, rnUnread };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { activeBrand } = useBrand();
  const pathname   = usePathname();
  const router     = useRouter();
  const { hasCatalystAccess, hasRnAccess } = useAdmin();
  const { careerUnread, rnUnread } = useUnreadSummary();

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

  const SidebarContent = () => (
    <>
      {/* Brand logo */}
      <div className="sidebar-logo">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label={activeBrand === 'ripple_nexus' ? 'Ripple Nexus · ClientForge' : 'Catalyst · ClientForge'}>
          <Logo variant="horizontal" size={34} brandId={activeBrand === 'ripple_nexus' ? 'ripple_nexus' : 'catalyst'} dark={false} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Main</span>
        {NAV_MAIN.map(({ href, Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item${isNavActive(href, pathname) ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="nav-icon"><Icon size={16} /></span>
            {label}
          </Link>
        ))}

        <span className="nav-section-label" style={{ marginTop: 16 }}>Services</span>
        {hasCatalystAccess && NAV_CAREER.map(({ href, Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item${isNavActive(href, pathname) ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="nav-icon"><Icon size={16} /></span>
            {label}
            {/* Unread badge */}
            {careerUnread > 0 && (
              <span style={{
                marginLeft: 'auto',
                minWidth: 18, height: 18,
                padding: '0 4px',
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {careerUnread > 99 ? '99+' : careerUnread}
              </span>
            )}
          </Link>
        ))}

        {activeBrand === 'ripple_nexus' && hasRnAccess && (
          <>
            <span className="nav-section-label" style={{ marginTop: 16, color: '#A78BFA' }}>Ripple Nexus</span>
            {NAV_RN.map(({ href, Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item${isNavActive(href, pathname) ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon" style={{ color: '#A78BFA' }}><Icon size={16} /></span>
                {label}
                {/* RN unread badge — only on Agency Clients nav item */}
                {href === '/rn/clients' && rnUnread > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: 18, height: 18,
                    padding: '0 4px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {rnUnread > 99 ? '99+' : rnUnread}
                  </span>
                )}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <NotificationBell />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Notifications</span>
        </div>
        <button className="nav-item" onClick={handleLogout} style={{ marginBottom: 6 }}>
          <span className="nav-icon" style={{ display: 'inline-flex' }}>
            <IconLogout size={16} />
          </span>
          Logout
        </button>
        <span className="sidebar-version">ClientForge · {activeBrand === 'ripple_nexus' ? 'B2B Agency' : 'Career Booster'}</span>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Overlay (mobile) ── */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-hidden="true"
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
          <span />
          <span />
          <span />
        </button>

        {/* Centered logo */}
        <div className="topbar-logo">
          <Logo variant="icon" size={28} brandId={activeBrand === 'ripple_nexus' ? 'ripple_nexus' : 'catalyst'} dark={false} />
        </div>

        {/* Notification bell in mobile topbar */}
        <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NotificationBell />
        </div>
      </header>

      {/* ── Content ── */}
      <div className="page-wrapper">
        {children}
      </div>

    </div>
  );
}
