'use client';
// src/app/rn/portal/[token]/PortalNavClient.tsx
// Client-side portal navigation (sidebar + mobile) with active state detection

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ICONS = {
  overview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  milestones: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  deliverables: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  messages: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

export default function PortalNavClient({
  token, unread, mobile = false,
}: {
  token: string;
  unread: number;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const base = `/rn/portal/${token}`;

  const tabs = [
    { href: base,                      label: 'Overview',     icon: 'overview',     exact: true  },
    { href: `${base}/milestones`,      label: 'Milestones',   icon: 'milestones',   exact: false },
    { href: `${base}/deliverables`,    label: 'Deliverables', icon: 'deliverables', exact: false },
    { href: `${base}/messages`,        label: 'Messages',     icon: 'messages',     exact: false },
  ] as const;

  if (mobile) {
    return (
      <>
        {tabs.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`portal-mobile-nav-item${active ? ' active' : ''}`}>
              {NAV_ICONS[icon]}
              <span>{label}</span>
              {icon === 'messages' && unread > 0 && (
                <span className="portal-nav-badge" style={{ position: 'absolute', top: 2, right: 6 }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <nav className="portal-nav">
      <div className="portal-nav-section">Navigation</div>
      {tabs.map(({ href, label, icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`portal-nav-item${active ? ' active' : ''}`}>
            {NAV_ICONS[icon]}
            <span>{label}</span>
            {icon === 'messages' && unread > 0 && (
              <span className="portal-nav-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
