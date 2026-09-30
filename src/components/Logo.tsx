import type { BrandId } from '@/lib/brand/types';

interface LogoProps {
  variant?: 'icon' | 'horizontal';
  size?: number;   // height of the mark in px
  dark?: boolean;  // true = for dark backgrounds (bone stroke, obsidian dot)
  brandId?: BrandId; // Defaults to catalyst
  showSubtitle?: boolean;
  subtitle?: string; // Custom subtitle text (e.g. TALENT POSITIONING ARCHITECTURE)
}

export function Logo({
  variant = 'horizontal',
  size = 40,
  dark = false,
  showSubtitle = true,
  subtitle = 'TPA · CLIENTFORGE',
}: LogoProps) {
  // CATALYST Logo
  const strokeFill = dark ? '#F4F1EB' : '#0A0B0D';
  const dotFill    = dark ? '#0A0B0D' : '#F4F1EB';
  const goldFill   = '#B8935B';
  const markW      = Math.round(size * (192 / 240));

  // Inflection Mark — viewBox 192×240 derived from brand system SVG
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
      {/* Primary Trajectory Stroke */}
      <polygon points="0,240 44,240 192,0 148,0" fill={strokeFill} />
      {/* Strategic Gold Intervention Stroke */}
      <polygon points="192,0 148,0 100,76 144,76" fill={goldFill} />
      {/* Inflection Pivot Dot */}
      <circle cx="170" cy="22" r="5" fill={dotFill} />
    </svg>
  );

  if (variant === 'icon') return mark;

  const textColor = dark ? '#F4F1EB' : '#0A0B0D';

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(10, Math.round(size * 0.28)) }}
      aria-label="Catalyst TPA"
    >
      {mark}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-cinzel), Cinzel, "Playfair Display", "Times New Roman", Georgia, serif',
            fontWeight: 800,
            fontSize: Math.round(size * 0.52),
            letterSpacing: '2.8px',
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
              letterSpacing: '1.8px',
              color: '#9A7540',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginTop: 3,
              userSelect: 'none',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
