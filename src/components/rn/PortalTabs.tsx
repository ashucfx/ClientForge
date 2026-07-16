'use client';
// src/components/rn/PortalTabs.tsx
// Client-portal navigation tabs with brand-book active state (cyan underline).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconGrid, IconDocument, IconMail, IconTarget } from '@/components/Icons';

export function PortalTabs({ token, unread }: { token: string; unread: number }) {
  const pathname = usePathname();
  const base = `/rn/portal/${token}`;

  const tabs = [
    { href: base, label: 'Overview', Icon: IconGrid, exact: true },
    { href: `${base}/milestones`, label: 'Milestones', Icon: IconTarget, exact: false },
    { href: `${base}/deliverables`, label: 'Deliverables', Icon: IconDocument, exact: false },
    { href: `${base}/messages`, label: 'Messages', Icon: IconMail, exact: false },
  ];

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 28, overflowX: 'auto' }}>
        {tabs.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: '16px 0 14px',
                color: active ? '#F4F5FA' : '#A1A1AA',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                whiteSpace: 'nowrap',
                borderBottom: active ? '2px solid #22D3EE' : '2px solid transparent',
              }}
            >
              <Icon size={16} /> {label}
              {label === 'Messages' && unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999 }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
