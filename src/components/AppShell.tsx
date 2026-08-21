'use client';
// src/components/AppShell.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// ── Inline icons ──────────────────────────────────────────────────
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
function IconCheckout({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 01-8 0" />
      </g>
    </svg>
  );
}
function IconInquire({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </g>
    </svg>
  );
}
function IconCalendar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
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
function IconStar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden>
      <polygon stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
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
  if (href === '/career') return pathname === '/career' || (pathname.startsWith('/career/') && !pathname.startsWith('/career/kanban') && !pathname.startsWith('/career/email-logs') && !pathname.startsWith('/career/calendar'));
  if (href === '/flywheel') return pathname === '/flywheel';
  if (href === '/sales/inquiries') return pathname.startsWith('/sales');
  return pathname.startsWith(href);
}

// ── Unread polling ────────────────────────────────────────────────
interface UnreadSummary { totalUnread: number }

function useUnreadSummary() {
  const [careerUnread, setCareerUnread] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/career/admin/unread-summary', { cache: 'no-store' });
      if (res.ok) setCareerUnread(((await res.json()) as UnreadSummary).totalUnread);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll]);

  return { careerUnread };
}

// ── Badge ─────────────────────────────────────────────────────────
function Badge({ count, accent, collapsed }: { count: number; accent?: string; collapsed?: boolean }) {
  if (!count) return null;
  if (collapsed) {
    return (
      <span
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          background: accent || '#ef4444',
          borderRadius: '50%',
          border: '1.5px solid var(--surface-2, #fff)',
        }}
        title={`${count} unread`}
      />
    );
  }
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
const COLLAPSED_STORAGE_KEY = 'cf_sidebar_collapsed';

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
  id, label, color, defaultOpen, hasActiveChild, badge, children, collapsed,
}: {
  id: string; label: string; color?: string; defaultOpen?: boolean;
  hasActiveChild?: boolean; badge?: number; children: React.ReactNode; collapsed?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    const saved = readSidebarState();
    return id in saved ? saved[id] : (defaultOpen ?? false);
  });

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

  if (collapsed) {
    return (
      <div className="nav-section-container">
        <div className="nav-section-divider" title={label} />
        <div className="w-full flex flex-col items-center">{children}</div>
      </div>
    );
  }

  return (
    <div className="nav-section-container" style={{ marginTop: 4 }}>
      <button
        onClick={toggle}
        className="nav-section-header"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderRadius: 6, border: 'none',
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
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

// ── Nav link ─────────────────────────────────────────────────────
function NavLink({
  href, icon, label, active, accent, badge = 0, onClick, external, collapsed,
}: {
  href: string; icon: React.ReactNode; label: string;
  active: boolean; accent?: string; badge?: number; onClick?: () => void; external?: boolean; collapsed?: boolean;
}) {
  const style = accent && !active ? { color: accent } : undefined;
  const inner = (
    <>
      <span className="nav-icon" style={style}>{icon}</span>
      {!collapsed && <span className="nav-label">{label}</span>}
      {!collapsed && external && (
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" className="ml-auto opacity-40" aria-hidden>
          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
        </svg>
      )}
      <Badge count={badge} collapsed={collapsed} />
    </>
  );

  const titleText = collapsed ? label : undefined;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={titleText}
        className={`nav-item${active ? ' active' : ''}`}
        style={style}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      title={titleText}
      className={`nav-item${active ? ' active' : ''}`}
      style={style}
    >
      {inner}
    </Link>
  );
}

// ── Sidebar inner content ─────────────────────────────────────────
interface SidebarProps {
  pathname: string;
  activeBrand: string;
  hasCatalystAccess: boolean;
  hasRnAccess: boolean;
  isSuperAdmin: boolean;
  careerUnread: number;
  onNavigate: () => void;
  onLogout: () => void;
  onSwitchTenant: () => void;
  switching: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawer?: boolean;
}

function SidebarContent({
  pathname, activeBrand, hasCatalystAccess, hasRnAccess,
  careerUnread, onNavigate, onLogout, onSwitchTenant, switching, isSuperAdmin,
  collapsed = false, onToggleCollapse, isMobileDrawer = false,
}: SidebarProps) {
  const inFinance = ['/invoices', '/analytics', '/reconciliation'].some(p => pathname.startsWith(p));
  const inCareer  = pathname.startsWith('/career');
  const inGrowth  = pathname.startsWith('/flywheel') || pathname.startsWith('/sales');
  const inTools   = pathname.startsWith('/bugs') || pathname.startsWith('/referrals') || pathname.startsWith('/team') || pathname.startsWith('/reviews') || pathname.startsWith('/settings');

  return (
    <>
      <div className="sidebar-logo">
        <div className="flex items-center justify-between w-full">
          <Link
            href="/"
            onClick={onNavigate}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
            aria-label={activeBrand === 'ripple_nexus' ? 'Ripple Nexus · ClientForge' : 'Catalyst · ClientForge'}
          >
            <Logo
              variant={collapsed ? 'icon' : 'horizontal'}
              size={collapsed ? 28 : 34}
              brandId={activeBrand === 'ripple_nexus' ? 'ripple_nexus' : 'catalyst'}
              dark={false}
            />
          </Link>

          {!isMobileDrawer && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="sidebar-collapse-btn"
              title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {isMobileDrawer && (
            <button
              onClick={onNavigate}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close drawer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Overview */}
        <NavLink
          href="/"
          icon={<IconGrid size={16} />}
          label="Dashboard"
          active={isActive('/', pathname)}
          onClick={onNavigate}
          collapsed={collapsed}
        />

        {/* Finance */}
        <NavSection id="finance" label="Finance" defaultOpen={true} hasActiveChild={inFinance} collapsed={collapsed}>
          <NavLink href="/invoices/new" icon={<IconPlus size={16} />} label="New Invoice"
            active={isActive('/invoices/new', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/invoices" icon={<IconList size={16} />} label="All Invoices"
            active={isActive('/invoices', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/analytics" icon={<IconAnalytics size={16} />} label="Analytics"
            active={isActive('/analytics', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/reconciliation" icon={<IconTrendUp size={16} />} label="Reconciliation"
            active={isActive('/reconciliation', pathname)} onClick={onNavigate} collapsed={collapsed} />
        </NavSection>

        {/* Branding Suite */}
        {hasCatalystAccess && (
          <NavSection id="career" label="Branding Suite" color="#B8935B"
            defaultOpen={inCareer} hasActiveChild={inCareer} badge={careerUnread} collapsed={collapsed}>
            <NavLink href="/career" icon={<IconTarget size={16} />} label="Clients"
              active={isActive('/career', pathname)} accent="#B8935B" badge={careerUnread} onClick={onNavigate} collapsed={collapsed} />
            <NavLink href="/career/kanban" icon={<IconKanban size={16} />} label="Kanban Board"
              active={isActive('/career/kanban', pathname)} accent="#B8935B" onClick={onNavigate} collapsed={collapsed} />
            <NavLink href="/career/email-logs" icon={<IconMail size={16} />} label="Email Logs"
              active={isActive('/career/email-logs', pathname)} accent="#B8935B" onClick={onNavigate} collapsed={collapsed} />
            <NavLink href="/career/calendar" icon={<IconCalendar size={16} />} label="Holiday Calendar"
              active={isActive('/career/calendar', pathname)} accent="#B8935B" onClick={onNavigate} collapsed={collapsed} />
            <NavLink href="/checkout" icon={<IconCheckout size={16} />} label="Self-Service Checkout"
              active={false} accent="#B8935B" external onClick={onNavigate} collapsed={collapsed} />
          </NavSection>
        )}

        {/* Growth */}
        <NavSection id="growth" label="Growth" color="#10B981"
          defaultOpen={inGrowth} hasActiveChild={inGrowth} collapsed={collapsed}>
          <NavLink href="/flywheel" icon={<IconZap size={16} />} label="Flywheel"
            active={isActive('/flywheel', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/sales/inquiries" icon={<IconInbox size={16} />} label="Sales Leads"
            active={isActive('/sales/inquiries', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/inquire" icon={<IconInquire size={16} />} label="Inquiry Form"
            active={false} accent="#10B981" external onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/flywheel/pipeline" icon={<IconPipeline size={16} />} label="Pipeline"
            active={isActive('/flywheel/pipeline', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/flywheel/leads" icon={<IconUser size={16} />} label="Audience"
            active={isActive('/flywheel/leads', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/flywheel/campaigns" icon={<IconMail size={16} />} label="Campaigns"
            active={isActive('/flywheel/campaigns', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/flywheel/merge-queue" icon={<IconUser size={16} />} label="Merge Queue"
            active={isActive('/flywheel/merge-queue', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/flywheel/analytics" icon={<IconAnalytics size={16} />} label="Flywheel Analytics"
            active={isActive('/flywheel/analytics', pathname)} accent="#10B981" onClick={onNavigate} collapsed={collapsed} />
        </NavSection>

        {/* Tools */}
        <NavSection id="tools" label="Tools" defaultOpen={inTools} hasActiveChild={inTools} collapsed={collapsed}>
          <NavLink href="/bugs" icon={<IconBug size={16} />} label="Bug Reports"
            active={isActive('/bugs', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/referrals" icon={<IconReferral size={16} />} label="Referrals"
            active={isActive('/referrals', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/reviews" icon={<IconStar size={16} />} label="Testimonials"
            active={isActive('/reviews', pathname)} onClick={onNavigate} collapsed={collapsed} />
          <NavLink href="/team" icon={<IconTeam size={16} />} label="Team & Access"
            active={isActive('/team', pathname)} onClick={onNavigate} collapsed={collapsed} />
          {isSuperAdmin && (
            <NavLink href="/settings" icon={
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" aria-hidden>
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                </g>
              </svg>
            } label="System Settings"
              active={isActive('/settings', pathname)} onClick={onNavigate} collapsed={collapsed} />
          )}
        </NavSection>
      </nav>

      <div className="sidebar-footer">
        <NotificationBell direction="up" label={collapsed ? undefined : 'Notifications'} />
        {hasRnAccess && (
          <button
            className="nav-item"
            onClick={onSwitchTenant}
            disabled={switching}
            title={collapsed ? (switching ? 'Switching…' : 'Switch to Ripple Nexus') : undefined}
            style={{ marginBottom: 2, width: '100%' }}
          >
            <span className="nav-icon" style={{ display: 'inline-flex' }}>
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" aria-hidden>
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3L4 7l4 4" /><path d="M4 7h16" />
                  <path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
                </g>
              </svg>
            </span>
            {!collapsed && (switching ? 'Switching…' : 'Switch to Ripple Nexus')}
          </button>
        )}
        <button
          className="nav-item"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          style={{ marginBottom: 6 }}
        >
          <span className="nav-icon" style={{ display: 'inline-flex' }}><IconLogout size={16} /></span>
          {!collapsed && 'Logout'}
        </button>
        {!collapsed && (
          <span className="sidebar-version">
            ClientForge · {activeBrand === 'ripple_nexus' ? 'B2B Agency' : 'Career Booster'}
          </span>
        )}
      </div>
    </>
  );
}

// ── AppShell ──────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { activeBrand } = useBrand();
  const pathname = usePathname();
  const { hasCatalystAccess, hasRnAccess, isSuperAdmin } = useAdmin();
  const { careerUnread } = useUnreadSummary();

  // Load collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch { /* ignore */ }
  }, []);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(prev => {
          const next = !prev;
          try { localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next)); } catch {}
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  const handleSwitchTenant = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: 'ripple_nexus' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
    } catch { /* ignore */ }
    setSwitching(false);
  };

  const baseSidebarProps = {
    pathname,
    activeBrand,
    hasCatalystAccess,
    hasRnAccess,
    isSuperAdmin,
    careerUnread,
    onLogout: handleLogout,
    onSwitchTenant: handleSwitchTenant,
    switching,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Desktop Fixed Sidebar (Collapsible) */}
      <aside className={`sidebar desktop-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <SidebarContent
          {...baseSidebarProps}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onNavigate={() => {}}
        />
      </aside>

      {/* Mobile Slide-in Drawer */}
      <aside className={`sidebar mobile-drawer${open ? ' mobile-drawer-open' : ''}`}>
        <SidebarContent
          {...baseSidebarProps}
          collapsed={false}
          isMobileDrawer
          onNavigate={() => setOpen(false)}
        />
      </aside>

      {/* Mobile Topbar */}
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

      {/* Main Content Area */}
      <div className={`page-wrapper ${collapsed ? 'page-wrapper-collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
}
