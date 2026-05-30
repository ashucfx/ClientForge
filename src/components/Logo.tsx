import type { BrandId } from '@/lib/brand/types';

interface LogoProps {
  variant?: 'icon' | 'horizontal';
  size?: number;   // height of the mark in px
  dark?: boolean;  // true = for dark backgrounds (bone stroke, obsidian dot)
  brandId?: BrandId; // Defaults to catalyst
}

export function Logo({ variant = 'horizontal', size = 40, dark = false, brandId = 'catalyst' }: LogoProps) {
  if (brandId === 'ripple_nexus') {
    const textColor = dark ? '#F4F5FA' : '#0A0B14';
    const markW = size; // RN icon is 1:1
    const mark = (
      <svg
        width={markW}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rn-grad-react" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#7C5CFF" />
            <stop offset="55%" stopColor="#9F7CFF" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="32" r="5" fill="url(#rn-grad-react)" />
        <path d="M 27 23.34 A 10 10 0 0 1 27 40.66" fill="none" stroke="url(#rn-grad-react)" strokeWidth="3" strokeLinecap="round" opacity="1" />
        <path d="M 34.73 19.27 A 18 18 0 0 1 34.73 44.73" fill="none" stroke="url(#rn-grad-react)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M 44.52 19 A 26 26 0 0 1 44.52 45" fill="none" stroke="url(#rn-grad-react)" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      </svg>
    );

    if (variant === 'icon') return mark;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) }} aria-label="Ripple Nexus">
        {mark}
        <span
          style={{
            fontFamily: 'Inter, Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: Math.round(size * 0.45),
            letterSpacing: '-0.3px',
            color: textColor,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          Ripple Nexus
        </span>
      </div>
    );
  }

  // CATALYST (Default)
  const strokeFill = dark ? '#F4F1EB' : '#0A0B0D';
  const dotFill    = dark ? '#0A0B0D' : '#F4F1EB';
  const markW      = Math.round(size * (192 / 240));

  // Inflection Mark — viewBox 192×240 derived from brand system SVG (scaled 60% of 320×400 base)
  const mark = (
    <svg
      width={markW}
      height={size}
      viewBox="0 0 192 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="0,240 44,240 192,0 148,0" fill={strokeFill} />
      <polygon points="192,0 148,0 100,76 144,76" fill="#B8935B" />
      <circle cx="170" cy="22" r="4.5" fill={dotFill} />
    </svg>
  );

  if (variant === 'icon') return mark;

  const textColor = dark ? '#F4F1EB' : '#0A0B0D';

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) }}
      aria-label="Catalyst"
    >
      {mark}
      <span
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 400,
          fontSize: Math.round(size * 0.52),
          letterSpacing: '0.5px',
          color: textColor,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        CATALYST
      </span>
    </div>
  );
}
