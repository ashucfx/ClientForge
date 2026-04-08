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
