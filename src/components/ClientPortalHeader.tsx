'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface ClientPortalHeaderProps {
  clientName?: string;
  unreadMessages?: number;
  title?: string;
  backHref?: string;
  backLabel?: string;
}

export function ClientPortalHeader({
  clientName,
  unreadMessages = 0,
  title,
  backHref,
  backLabel = 'Back to dashboard',
}: ClientPortalHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDashboard = pathname === '/portal/dashboard';

  const logout = async () => {
    await fetch('/api/career/auth/verify', { method: 'DELETE' });
    router.replace('/portal/login');
  };

  const Icon = ({ kind }: { kind: 'menu' | 'close' | 'messages' | 'signout' }) => (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'menu' && <><path d="M4 7h16M4 12h16M4 17h16" /></>}
      {kind === 'close' && <><path d="m6 6 12 12M18 6 6 18" /></>}
      {kind === 'messages' && <><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8M8 13h5" /></>}
      {kind === 'signout' && <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></>}
    </svg>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[#E8DDD0] bg-[#fffdfa]/95 shadow-[0_4px_18px_rgba(15,23,42,.04)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {!isDashboard && backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5D8C5] text-slate-500 transition-colors hover:bg-[#F5F1EB] hover:text-slate-900"
              aria-label={backLabel}
              title={backLabel}
            >
              <span aria-hidden>←</span>
            </Link>
          ) : null}
          <Link href="/portal/dashboard/profile" className="flex min-w-0 items-center gap-2.5" aria-label="Open your Catalyst profile">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D8C8B0] bg-black shadow-sm">
              <Image src="/logos/catalyst-symbol-dark.svg" width={20} height={20} alt="" className="object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900">Catalyst</span>
              <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.16em] leading-tight text-[#9A7540]">
                {title || 'Client portal'}
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Client portal">
          <Link
            href="/portal/dashboard"
            className={`hidden rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex ${
              isDashboard ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-500 hover:bg-[#F5F1EB] hover:text-slate-900'
            }`}
          >
            Overview
          </Link>
          <Link
            href="/portal/dashboard/files"
            className={`hidden rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex ${
              pathname.startsWith('/portal/dashboard/files') ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-500 hover:bg-[#F5F1EB] hover:text-slate-900'
            }`}
          >
            Files
          </Link>
          <Link
            href="/portal/dashboard/profile"
            className={`hidden rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:inline-flex ${
              pathname.startsWith('/portal/dashboard/profile') ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-500 hover:bg-[#F5F1EB] hover:text-slate-900'
            }`}
          >
            Profile
          </Link>
          <Link
            href="/portal/dashboard#messages"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-[#F5F1EB] hover:text-slate-900"
            aria-label="Messages"
            title="Messages"
          >
            <Icon kind="messages" />
            {unreadMessages > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#fffdfa] bg-red-500" /> : null}
          </Link>
          {clientName ? (
            <span className="hidden max-w-[130px] truncate rounded-xl border border-[#E5D8C5] bg-[#FBF8F3] px-3 py-2 text-xs font-semibold text-slate-700 sm:inline-flex">
              {clientName.split(' ')[0]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setMobileOpen(value => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5D8C5] text-slate-500 transition-colors hover:bg-white hover:text-slate-900 sm:hidden"
            aria-label={mobileOpen ? 'Close portal menu' : 'Open portal menu'}
            aria-expanded={mobileOpen}
          >
            <Icon kind={mobileOpen ? 'close' : 'menu'} />
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5D8C5] px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
          >
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden"><Icon kind="signout" /></span>
          </button>
        </nav>
      </div>
      {mobileOpen && (
        <div className="border-t border-[#E8DDD0] bg-[#fffdfa] px-4 py-3 shadow-lg sm:hidden">
          <nav className="grid gap-1" aria-label="Mobile client portal">
            <Link href="/portal/dashboard" onClick={() => setMobileOpen(false)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${isDashboard ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-600 hover:bg-[#F8F5F1]'}`}>Overview</Link>
            <Link href="/portal/dashboard/files" onClick={() => setMobileOpen(false)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${pathname.startsWith('/portal/dashboard/files') ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-600 hover:bg-[#F8F5F1]'}`}>Files</Link>
            <Link href="/portal/dashboard/profile" onClick={() => setMobileOpen(false)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${pathname.startsWith('/portal/dashboard/profile') ? 'bg-[#F5F1EB] text-[#7A5B2E]' : 'text-slate-600 hover:bg-[#F8F5F1]'}`}>Profile</Link>
            <Link href="/portal/dashboard#messages" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-[#F8F5F1]">Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ''}</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
