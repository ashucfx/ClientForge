'use client';
// src/components/AppShell.tsx
// Shared responsive shell: sidebar on desktop, drawer + topbar on mobile

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogoSidebar, Logo } from '@/components/Logo';
import { IconLogout } from '@/components/Icons';

const NAV = [
  { href: '/',             icon: '▪', label: 'Dashboard'   },
  { href: '/invoices/new', icon: '+', label: 'New Invoice' },
  { href: '/invoices',     icon: '≡', label: 'All Invoices'},
];

function isNavActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href === '/invoices/new') return pathname === '/invoices/new';
  if (href === '/invoices') return pathname.startsWith('/invoices') && pathname !== '/invoices/new';
  return pathname.startsWith(href);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/login');
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <LogoSidebar size={40} />
      </div>
      <nav className="sidebar-nav">
        <span className="nav-section-label">Main</span>
        {NAV.map(n => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item${isNavActive(n.href, pathname) ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="nav-icon" style={{ fontSize: 15 }}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={handleLogout}
          style={{ color: 'rgba(255,255,255,.75)' }}
        >
          <span className="nav-icon" style={{ display: 'inline-flex', color: 'rgba(255,255,255,.75)' }}>
            <IconLogout />
          </span>
          Logout
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.22)' }}>ClientForge · Ripple Nexus</span>
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
          className="hamburger"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Logo variant="horizontal" size={28} />
        </div>
        <div style={{ width: 40 }} />
      </header>

      {/* ── Content ── */}
      <div className="page-wrapper">
        {children}
      </div>

    </div>
  );
}
