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

