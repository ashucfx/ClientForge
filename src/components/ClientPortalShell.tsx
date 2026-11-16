'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PortalNavItem = {
  label: string;
  href: string;
  icon: 'home' | 'brief' | 'files' | 'messages' | 'profile';
  badge?: number;
  hash?: string;
};

const NAV_ITEMS: PortalNavItem[] = [
  { label: 'Overview', href: '/portal/dashboard', icon: 'home' },
  { label: 'My brief', href: '/portal/dashboard#forms', icon: 'brief', hash: '#forms' },
  { label: 'Files', href: '/portal/dashboard/files', icon: 'files' },
  { label: 'Messages', href: '/portal/dashboard#messages', icon: 'messages', hash: '#messages' },
  { label: 'Profile', href: '/portal/dashboard/profile', icon: 'profile' },
];

function PortalIcon({ kind, className = 'h-5 w-5' }: { kind: PortalNavItem['icon'] | 'menu' | 'close' | 'logout'; className?: string }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6"/></>,
    brief: <><path d="M6 3.75h8l4 4V20H6z"/><path d="M14 3.75v4h4M9 12h6M9 16h6"/></>,
    files: <><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 10h17"/></>,
    messages: <><path d="M4 5h16v12H8l-4 3V5Z"/><path d="M8 9h8M8 13h5"/></>,
    profile: <><circle cx="12" cy="8" r="3.25"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  } as const;

  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

function navIsActive(item: PortalNavItem, pathname: string, hash: string) {
  if (item.hash) return pathname === '/portal/dashboard' && hash === item.hash;
  if (item.href === '/portal/dashboard') return pathname === item.href && !hash;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ClientPortalShell({
  clientName,
  unreadMessages = 0,
  title = 'Client workspace',
}: {
  clientName?: string;
  unreadMessages?: number;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const name = clientName?.trim() || 'Client';
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    const readHash = () => setActiveHash(window.location.hash);
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const logout = async () => {
    try {
      await fetch('/api/career/auth/verify', { method: 'DELETE' });
    } finally {
      router.replace('/portal/login');
    }
  };

  const closeMenu = () => setMobileOpen(false);

  const renderNavItem = (item: PortalNavItem, compact = false) => {
    const active = navIsActive(item, pathname, activeHash);
    return (
      <Link
        key={item.label}
        href={item.href}
        onClick={closeMenu}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
          active
            ? 'bg-[#F3EBDD] text-[#76562A]'
            : 'text-slate-600 hover:bg-[#F8F5F0] hover:text-slate-950'
        } ${compact ? 'flex-col justify-center gap-1 px-1 py-2 text-[10px]' : 'py-2.5'}`}
      >
        <span className={`relative flex shrink-0 items-center justify-center ${compact ? 'h-6 w-6' : 'h-8 w-8 rounded-lg'} ${active && !compact ? 'bg-white text-[#9A7540] shadow-[0_1px_3px_rgba(15,23,42,.08)]' : active ? 'text-[#9A7540]' : 'text-slate-400 group-hover:text-slate-700'}`}>
          <PortalIcon kind={item.icon} className={compact ? 'h-[18px] w-[18px]' : 'h-[17px] w-[17px]'} />
          {item.icon === 'messages' && unreadMessages > 0 && compact && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-white bg-rose-500" />}
        </span>
        <span className={compact ? 'max-w-full truncate' : 'min-w-0 flex-1 truncate'}>{item.label}</span>
        {!compact && item.icon === 'messages' && unreadMessages > 0 && (
          <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
        {compact && item.icon === 'messages' && unreadMessages > 0 && (
          <span className="absolute right-1 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E8DDD0] bg-[#fffdfa]/95 shadow-[0_4px_18px_rgba(15,23,42,.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 items-center gap-3 px-4 sm:px-6 lg:ml-64 lg:mr-0 lg:pl-8 lg:pr-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open workspace navigation"
            aria-expanded={mobileOpen}
            aria-controls="client-portal-navigation"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E8DDD0] bg-white text-slate-600 shadow-sm transition hover:border-[#D8C8B0] hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40 lg:hidden"
          >
            <PortalIcon kind="menu" className="h-[18px] w-[18px]" />
          </button>

          <Link href="/portal/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="Catalyst client workspace overview">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D8C8B0] bg-[#0A0B0D] shadow-sm">
              <Image src="/logos/catalyst-symbol-dark.svg" width={20} height={20} alt="" className="object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-[#0A0B0D]">Catalyst</span>
              <span className="block max-w-[150px] truncate text-[9px] font-semibold uppercase leading-tight tracking-[0.16em] text-[#9A7540] sm:max-w-none">{title}</span>
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/portal/dashboard#messages"
              aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
              title="Messages"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[#F5F1EB] hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40"
            >
              <PortalIcon kind="messages" className="h-[18px] w-[18px]" />
              {unreadMessages > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#fffdfa] bg-rose-500" />}
            </Link>
            <Link href="/portal/dashboard/profile" className="hidden max-w-44 items-center gap-2 rounded-xl border border-[#E8DDD0] bg-white px-2 py-1.5 transition hover:border-[#D8C8B0] sm:flex">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B8935B] text-[11px] font-bold text-white">{initial}</span>
              <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{name.split(' ')[0]}</span>
            </Link>
            <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="hidden h-10 items-center gap-2 rounded-xl border border-[#E8DDD0] px-3 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40 lg:inline-flex">
              <PortalIcon kind="logout" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && <button type="button" aria-label="Close workspace navigation" onClick={closeMenu} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden" />}

      <aside
        id="client-portal-navigation"
        aria-label="Client workspace navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,21rem)] flex-col border-r border-[#E8DDD0] bg-[#fffdfa] shadow-2xl transition-transform duration-200 lg:inset-y-16 lg:z-30 lg:w-64 lg:translate-x-0 lg:shadow-none ${mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'}`}
      >
        <div className="flex items-center justify-between border-b border-[#EEE7DC] px-5 py-5 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0B0D] text-sm font-bold text-[#C9A96E]">C</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900">Client workspace</span>
              <span className="block truncate text-xs text-slate-500">{name}</span>
            </span>
          </div>
          <button type="button" onClick={closeMenu} aria-label="Close navigation" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-[#F5F1EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40">
            <PortalIcon kind="close" className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-5 pb-2 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5" aria-label="Workspace pages">
          {NAV_ITEMS.map(item => renderNavItem(item))}
        </nav>

        <div className="border-t border-[#EEE7DC] p-3">
          <Link href="/portal/dashboard/profile" onClick={closeMenu} className="flex min-w-0 items-center gap-3 rounded-xl p-2 transition hover:bg-[#F8F5F0]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B8935B] text-sm font-bold text-white">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-slate-800">{name}</span>
              <span className="block text-[10px] text-slate-500">Account profile</span>
            </span>
            <PortalIcon kind="profile" className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
          <button type="button" onClick={() => void logout()} className="mt-1 inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8935B]/40 lg:hidden">
            <PortalIcon kind="logout" className="h-[17px] w-[17px]" />
            Sign out
          </button>
          <a href="mailto:catalyst@theripplenexus.com" className="mt-1 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium text-slate-500 transition hover:bg-[#F8F5F0] hover:text-slate-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#F3EBDD] text-[#9A7540]">?</span>
            Need help? Contact us
          </a>
        </div>
      </aside>

      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E8DDD0] bg-[#fffdfa]/95 px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,.08)] backdrop-blur-xl lg:hidden">
        {NAV_ITEMS.map(item => renderNavItem(item, true))}
      </nav>
    </>
  );
}
