'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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
  const isDashboard = pathname === '/portal/dashboard';

  const logout = async () => {
    await fetch('/api/career/auth/verify', { method: 'DELETE' });
    router.replace('/portal/login');
  };

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
            <span aria-hidden>✦</span>
            {unreadMessages > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#fffdfa] bg-red-500" /> : null}
          </Link>
          {clientName ? (
            <span className="hidden max-w-[130px] truncate rounded-xl border border-[#E5D8C5] bg-[#FBF8F3] px-3 py-2 text-xs font-semibold text-slate-700 sm:inline-flex">
              {clientName.split(' ')[0]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5D8C5] px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
          >
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden" aria-hidden>↗</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
