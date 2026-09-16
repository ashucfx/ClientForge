import type { BrandId } from '@/lib/brand/types';

interface LogoProps {
  variant?: 'icon' | 'horizontal';
  size?: number;   // height of the mark in px
  dark?: boolean;  // true = for dark backgrounds (bone stroke, obsidian dot)
  brandId?: BrandId; // Defaults to catalyst
  showSubtitle?: boolean;
}

export function Logo({ variant = 'horizontal', size = 40, dark = false, showSubtitle = true }: LogoProps) {
  // CATALYST Logo
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
      style={{ flexShrink: 0 }}
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
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, Math.round(size * 0.28)) }}
      aria-label="Catalyst TPA"
    >
      {mark}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-cinzel), Cinzel, "Playfair Display", "Times New Roman", Georgia, serif',
            fontWeight: 700,
            fontSize: Math.round(size * 0.52),
            letterSpacing: '2.4px',
            color: textColor,
            lineHeight: 1.05,
            userSelect: 'none',
            textTransform: 'uppercase',
          }}
        >
          CATALYST
        </span>
        {showSubtitle && (
          <span
            style={{
              fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 800,
              fontSize: Math.max(8, Math.round(size * 0.22)),
              letterSpacing: '1.6px',
              color: '#B8935B',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginTop: 2.5,
              userSelect: 'none',
            }}
          >
            TPA · CLIENTFORGE
          </span>
        )}
      </div>
    </div>
  );
}
