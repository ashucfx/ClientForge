'use client';
// src/components/AppShell.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconGrid, IconPlus, IconList, IconLogout, IconTarget, IconUser,
  IconTrendUp, IconMail, IconZap, IconInbox, IconChevronDown,
} from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { useBrand } from '@/components/BrandProvider';
import { useAdmin } from '@/components/AdminProvider';
import NotificationBell from '@/components/NotificationBell';

// ── Inline icons not in Icons.tsx ────────────────────────────────
function IconBug({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2l1.88 1.88M16 2l-1.88 1.88M9 7.13v-1a3 3 0 013-3h0a3 3 0 013 3v1" />
        <path d="M12 20c-3.31 0-6-2.69-6-6v-3a6 6 0 0112 0v3c0 3.31-2.69 6-6 6z" />
        <path d="M6 13H2M22 13h-4M6 17H2M22 17h-4" />
      </g>
    </svg>
  );
}
function IconReferral({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </g>
    </svg>
  );
}
function IconKanban({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="3" width="5" height="12" rx="1" />
        <rect x="17" y="3" width="5" height="8" rx="1" />
      </g>
    </svg>
  );
}
function IconPipeline({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </g>
    </svg>
  );
}
function IconAnalytics({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 14l3-3 3 3 4-4" />
      </g>
    </svg>
  );
}
function IconTeam({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </g>
    </svg>
  );
}

// ── Active check ──────────────────────────────────────────────────
function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href === '/invoices/new') return pathname === '/invoices/new';
  if (href === '/invoices') return pathname.startsWith('/invoices') && pathname !== '/invoices/new';
  if (href === '/career') return pathname === '/career' || (pathname.startsWith('/career/') && !pathname.startsWith('/career/kanban'));
  if (href === '/flywheel') return pathname === '/flywheel';
  if (href === '/sales/inquiries') return pathname.startsWith('/sales');
  return pathname.startsWith(href);
}

// ── Unread polling ────────────────────────────────────────────────
interface UnreadSummary { totalUnread: number }

function useUnreadSummary() {
  const [careerUnread, setCareerUnread] = useState(0);
  const [rnUnread, setRnUnread] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const [c, r] = await Promise.allSettled([
        fetch('/api/career/admin/unread-summary', { cache: 'no-store' }),
        fetch('/api/rn/admin/unread-summary', { cache: 'no-store' }),
      ]);
      if (c.status === 'fulfilled' && c.value.ok)
        setCareerUnread(((await c.value.json()) as UnreadSummary).totalUnread);
      if (r.status === 'fulfilled' && r.value.ok)
        setRnUnread(((await r.value.json()) as UnreadSummary).totalUnread);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll]);

  return { careerUnread, rnUnread };
}

// ── Badge ─────────────────────────────────────────────────────────
function Badge({ count, accent }: { count: number; accent?: string }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 4px',
      background: accent || '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
      borderRadius: 999, display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── localStorage helpers ──────────────────────────────────────────
const STORAGE_KEY = 'cf_sidebar_sections';

function readSidebarState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function writeSidebarState(key: string, open: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const state = readSidebarState();
    state[key] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ── Collapsible section ───────────────────────────────────────────
function NavSection({
  id, label, color, defaultOpen, hasActiveChild, badge, children,
}: {
  id: string; label: string; color?: string; defaultOpen?: boolean;
  hasActiveChild?: boolean; badge?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => {
    const saved = readSidebarState();
    // if we have a saved value use it; otherwise fall back to defaultOpen
    return id in saved ? saved[id] : (defaultOpen ?? false);
  });

  // auto-open when route enters this section (but don't collapse it when leaving)
  const prevActive = useRef(hasActiveChild);
  useEffect(() => {
    if (hasActiveChild && !prevActive.current) {
      setOpen(true);
      writeSidebarState(id, true);
    }
    prevActive.current = hasActiveChild;
  }, [hasActiveChild, id]);

  const toggle = () => {
    setOpen(o => {
      const next = !o;
      writeSidebarState(id, next);
      return next;
    });
  };

  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', borderRadius: 6, border: 'none',
          background: hasActiveChild ? `${color ?? 'var(--brand)'}12` : 'none',
          cursor: 'pointer', color: hasActiveChild ? (color ?? 'var(--brand)') : (color ?? 'var(--text-tertiary)'),
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px',
          marginBottom: 2, transition: 'background 0.15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasActiveChild && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color ?? 'var(--brand)', display: 'inline-block', flexShrink: 0 }} />
          )}
          {label}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {badge ? <Badge count={badge} accent={color} /> : null}
          <IconChevronDown
            size={12}
            style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', opacity: 0.6 }}
          />
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Nav link ─────────────────────────────────────────────────────
function NavLink({
  href, icon, label, active, accent, badge = 0, onClick,
}: {
  href: string; icon: React.ReactNode; label: string;
  active: boolean; accent?: string; badge?: number; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-item${active ? ' active' : ''}`}
      style={accent && !active ? { color: accent } : undefined}
    >
      <span className="nav-icon" style={accent && !active ? { color: accent } : undefined}>{icon}</span>
      {label}
      <Badge count={badge} />
    </Link>
  );
}

// ── Sidebar inner content (stable component outside AppShell) ─────
interface SidebarProps {
  pathname: string;
  activeBrand: string;
  hasCatalystAccess: boolean;
  hasRnAccess: boolean;
  careerUnread: number;
  rnUnread: number;
  onNavigate: () => void;
  onLogout: () => void;
}

function SidebarContent({
  pathname, activeBrand, hasCatalystAccess, hasRnAccess,
  careerUnread, rnUnread, onNavigate, onLogout,
}: SidebarProps) {
  const inFinance = ['/invoices', '/analytics'].some(p => pathname.startsWith(p));
  const inCareer  = pathname.startsWith('/career');
  const inGrowth  = pathname.startsWith('/flywheel') || pathname.startsWith('/sales');
  const inTools   = pathname.startsWith('/bugs') || pathname.startsWith('/referrals') || pathname.startsWith('/team');
  const inRN      = pathname.startsWith('/rn/');

  return (
    <>
      <div className="sidebar-logo">
        <Link
          href="/"
          onClick={onNavigate}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
          aria-label={activeBrand === 'ripple_nexus' ? 'Ripple Nexus · ClientForge' : 'Catalyst · ClientForge'}
        >
          <Logo variant="horizontal" size={34}
            brandId={activeBrand === 'ripple_nexus' ? 'ripple_nexus' : 'catalyst'} dark={false} />
        </Link>
      </div>

      <nav className="sidebar-nav">
        {/* Overview */}
        <NavLink href="/" icon={<IconGrid size={16} />} label="Dashboard"
          active={isActive('/', pathname)} onClick={onNavigate} />

        {/* Finance */}
        <NavSection id="finance" label="Finance" defaultOpen={true} hasActiveChild={inFinance}>
          <NavLink href="/invoices/new" icon={<IconPlus size={16} />} label="New Invoice"
            active={isActive('/invoices/new', pathname)} onClick={onNavigate} />
          <NavLink href="/invoices" icon={<IconList size={16} />} label="All Invoices"
            active={isActive('/invoices', pathname)} onClick={onNavigate} />
          <NavLink href="/analytics" icon={<IconAnalytics size={16} />} label="Analytics"
            active={isActive('/analytics', pathname)} onClick={onNavigate} />
        </NavSection>

        {/* Career Booster */}
        {hasCatalystAccess && (
          <NavSection id="career" label="Career Booster" color="#B8935B"
            defaultOpen={inCareer} hasActiveChild={inCareer} badge={careerUnread}>
            <NavLink href="/career" icon={<IconTarget size={16} />} label="Clients"
              active={isActive('/career', pathname)} accent="#B8935B" badge={careerUnread} onClick={onNavigate} />
            <NavLink href="/career/kanban" icon={<IconKanban size={16} />} label="Kanban Board"
              active={isActive('/career/kanban', pathname)} accent="#B8935B" onClick={onNavigate} />
            <NavLink href="/career/email-logs" icon={<IconMail size={16} />} label="Email Logs"
              active={isActive('/career/email-logs', pathname)} accent="#B8935B" onClick={onNavigate} />
          </NavSection>
        )}

        {/* Growth */}
        <NavSection id="growth" label="Growth" color="#10B981"
          defaultOpen={inGrowth} hasActiveChild={inGrowth}>
          <NavLink href="/flywheel" icon={<IconZap size={16} />} label="Flywheel"
            active={isActive('/flywheel', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/sales/inquiries" icon={<IconInbox size={16} />} label="Sales Leads"
            active={isActive('/sales/inquiries', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/flywheel/pipeline" icon={<IconPipeline size={16} />} label="Pipeline"
            active={isActive('/flywheel/pipeline', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/flywheel/leads" icon={<IconUser size={16} />} label="Audience"
            active={isActive('/flywheel/leads', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/flywheel/campaigns" icon={<IconMail size={16} />} label="Campaigns"
            active={isActive('/flywheel/campaigns', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/flywheel/merge-queue" icon={<IconUser size={16} />} label="Merge Queue"
            active={isActive('/flywheel/merge-queue', pathname)} accent="#10B981" onClick={onNavigate} />
          <NavLink href="/flywheel/analytics" icon={<IconAnalytics size={16} />} label="Flywheel Analytics"
            active={isActive('/flywheel/analytics', pathname)} accent="#10B981" onClick={onNavigate} />
        </NavSection>

        {/* Tools */}
        <NavSection id="tools" label="Tools" defaultOpen={inTools} hasActiveChild={inTools}>
          <NavLink href="/bugs" icon={<IconBug size={16} />} label="Bug Reports"
            active={isActive('/bugs', pathname)} onClick={onNavigate} />
          <NavLink href="/referrals" icon={<IconReferral size={16} />} label="Referrals"
            active={isActive('/referrals', pathname)} onClick={onNavigate} />
          <NavLink href="/team" icon={<IconTeam size={16} />} label="Team & Access"
            active={isActive('/team', pathname)} onClick={onNavigate} />
        </NavSection>

        {/* Ripple Nexus */}
        {activeBrand === 'ripple_nexus' && hasRnAccess && (
          <NavSection id="rn" label="Ripple Nexus" color="#A78BFA"
            defaultOpen={inRN} hasActiveChild={inRN} badge={rnUnread}>
            <NavLink href="/rn/clients" icon={<IconUser size={16} />} label="Agency Clients"
              active={isActive('/rn/clients', pathname)} accent="#A78BFA" badge={rnUnread} onClick={onNavigate} />
            <NavLink href="/rn/services" icon={<IconTarget size={16} />} label="Services"
              active={isActive('/rn/services', pathname)} accent="#A78BFA" onClick={onNavigate} />
          </NavSection>
        )}
      </nav>

      <div className="sidebar-footer">
        <NotificationBell direction="up" label="Notifications" />
        <button className="nav-item" onClick={onLogout} style={{ marginBottom: 6 }}>
          <span className="nav-icon" style={{ display: 'inline-flex' }}><IconLogout size={16} /></span>
          Logout
        </button>
        <span className="sidebar-version">
          ClientForge · {activeBrand === 'ripple_nexus' ? 'B2B Agency' : 'Career Booster'}
        </span>
      </div>
    </>
  );
}

// ── AppShell ──────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { activeBrand } = useBrand();
  const pathname = usePathname();
  const { hasCatalystAccess, hasRnAccess } = useAdmin();
  const { careerUnread, rnUnread } = useUnreadSummary();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  const sidebarProps: SidebarProps = {
    pathname,
    activeBrand,
    hasCatalystAccess,
    hasRnAccess,
    careerUnread,
    rnUnread,
    onNavigate: () => setOpen(false),
    onLogout: handleLogout,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className="sidebar desktop-sidebar">
        <SidebarContent {...sidebarProps} />
      </aside>
      <aside className={`sidebar mobile-drawer${open ? ' mobile-drawer-open' : ''}`}>
        <SidebarContent {...sidebarProps} />
      </aside>

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
          <Logo variant="icon" size={28}
            brandId={activeBrand === 'ripple_nexus' ? 'ripple_nexus' : 'catalyst'} dark={false} />
        </div>
        <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NotificationBell />
        </div>
      </header>

      <div className="page-wrapper">{children}</div>
    </div>
  );
}
