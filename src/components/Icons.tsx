// src/components/Icons.tsx

import type { CSSProperties } from 'react';

function baseProps(size: number, style?: CSSProperties) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    style,
    'aria-hidden': true as const,
  };
}

function StrokeIcon({
  children,
  size = 18,
  strokeWidth = 2,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <svg {...baseProps(size, style)}>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export function IconDocument({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </StrokeIcon>
  );
}

export function IconPending({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </StrokeIcon>
  );
}

export function IconCheck({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3L15.8 9.8" />
    </StrokeIcon>
  );
}

export function IconTrendUp({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </StrokeIcon>
  );
}

export function IconSearch({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </StrokeIcon>
  );
}

export function IconUser({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M12 12a4 4 0 1 0-0.001-8.001A4 4 0 0 0 12 12z" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </StrokeIcon>
  );
}

export function IconList({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M8 7h13" />
      <path d="M8 12h13" />
      <path d="M8 17h13" />
      <path d="M3.5 7h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 17h.01" />
    </StrokeIcon>
  );
}

export function IconSettings({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.9 7.9 0 0 0-1.7-1l-.4-2.7H10l-.4 2.7a7.9 7.9 0 0 0-1.7 1l-2.5-1-2 3.4L5.6 13a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1L3.5 16.6l2 3.4 2.5-1a7.9 7.9 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.9 7.9 0 0 0 1.7-1l2.5 1 2-3.4L19.4 15z" />
    </StrokeIcon>
  );
}

export function IconSpinner({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg {...baseProps(size, style)} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3a9 9 0 1 0 9 9" />
      </g>
    </svg>
  );
}

export function IconLink({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M10.5 13.5l3-3" />
      <path d="M8 14a4 4 0 0 1 0-6l1.5-1.5a4 4 0 0 1 6 0" />
      <path d="M16 10a4 4 0 0 1 0 6L14.5 17.5a4 4 0 0 1-6 0" />
    </StrokeIcon>
  );
}

export function IconMail({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M4 6h16v12H4z" />
      <path d="M4 7l8 6 8-6" />
    </StrokeIcon>
  );
}

export function IconCreditCard({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M3.5 7.5h17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
      <path d="M1.5 10.5h21" />
      <path d="M6 15h4" />
    </StrokeIcon>
  );
}

export function IconAlert({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M12 3.5l9 16H3l9-16z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </StrokeIcon>
  );
}

export function IconTarget({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </StrokeIcon>
  );
}

export function IconLogout({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M10 7V6a2.5 2.5 0 0 1 2.5-2.5H19a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 19 20.5h-6.5A2.5 2.5 0 0 1 10 18v-1" />
      <path d="M3.5 12h9" />
      <path d="M7 8.5L3.5 12 7 15.5" />
    </StrokeIcon>
  );
}

export function IconGrid({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </StrokeIcon>
  );
}

export function IconPlus({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </StrokeIcon>
  );
}

export function IconBuilding({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </StrokeIcon>
  );
}

export function IconHome({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </StrokeIcon>
  );
}

export function IconFolder({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </StrokeIcon>
  );
}

export function IconInbox({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <StrokeIcon size={size} style={style}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </StrokeIcon>
  );
}
