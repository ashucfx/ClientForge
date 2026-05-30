'use client';
// src/components/shells/RippleNexusShell.tsx
// Dedicated shell for Ripple Nexus B2B operations
// NO conditionals, NO Catalyst contamination.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconGrid, IconPlus, IconList, IconLogout, IconTarget, IconUser, IconLink, IconBuilding, IconHome, IconFolder, IconInbox } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import '@/app/(protected)/rn/rn.css';

const RN_NAV = [
  { href: '/rn/dashboard',    Icon: IconHome,     label: 'Overview',            section: 'Workspace' },
  { href: '/rn/projects',     Icon: IconFolder,   label: 'Projects',            section: 'Workspace' },
  { href: '/rn/inbox',        Icon: IconInbox,    label: 'Inbox',               section: 'Workspace' },
  
  { href: '/rn/clients',      Icon: IconUser,     label: 'Clients',             section: 'Operations' },
  { href: '/rn/services',     Icon: IconTarget,   label: 'Service Workflows',   section: 'Operations' },
  { href: '/rn/deliverables', Icon: IconGrid,     label: 'Global Deliverables', section: 'Operations' },
  
  { href: '/rn/invoices',     Icon: IconList,     label: 'Billing',             section: 'Operations' },
];

function isNavActive(href: string, pathname: string) {
  if (href === '/rn/invoices/new') return pathname === '/rn/invoices/new';
  if (href === '/rn/invoices') return pathname.startsWith('/rn/invoices') && pathname !== '/rn/invoices/new';
  return pathname.startsWith(href);
}

export function RippleNexusShell({ children }: { children: React.ReactNode }) {
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
      {/* Brand logo */}
      <div className="sidebar-logo">
        <Link href="/rn/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label="Ripple Nexus">
          <Logo variant="horizontal" size={34} brandId="ripple_nexus" dark={false} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Workspace</span>
        {RN_NAV.filter(n => n.section === 'Workspace').map(({ href, Icon, label }) => (
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

        <span className="nav-section-label">Operations</span>
        {RN_NAV.filter(n => n.section === 'Operations').map(({ href, Icon, label }) => (
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
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="nav-item" onClick={handleLogout} style={{ marginBottom: 6 }}>
          <span className="nav-icon" style={{ display: 'inline-flex' }}>
            <IconLogout size={16} />
          </span>
          Logout
        </button>
        <span className="sidebar-version">ClientForge · B2B Agency</span>
      </div>
    </>
  );

  return (
    <div 
      data-tenant="ripple_nexus"
      style={{ 
        minHeight: '100vh', 
      } as React.CSSProperties}
    >
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
          <Logo variant="icon" size={28} brandId="ripple_nexus" dark={false} />
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
