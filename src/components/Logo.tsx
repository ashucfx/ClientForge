import type { BrandId } from '@/lib/brand/types';

interface LogoProps {
  variant?: 'icon' | 'horizontal';
  size?: number;   // height of the mark in px
  dark?: boolean;  // true = for dark backgrounds (bone stroke, obsidian dot)
  brandId?: BrandId; // Defaults to catalyst
}

export function Logo({ variant = 'horizontal', size = 40, dark = false, brandId = 'catalyst' }: LogoProps) {
  if (brandId === 'ripple_nexus') {
    // Official assets from the Ripple Nexus Brand System (02-logos).
    // `dark` = rendered on a dark background → use the dark-background lockup.
    if (variant === 'icon') {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logos/rn/logo-icon-mark.svg"
          alt="Ripple Nexus"
          height={size}
          width={size}
          style={{ display: 'block' }}
          draggable={false}
        />
      );
    }

    const src = dark ? '/logos/rn/logo-horizontal-dark.svg' : '/logos/rn/logo-horizontal-light.svg';
    // Horizontal lockup viewBox is 360×80 (4.5:1)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Ripple Nexus"
        height={size}
        width={Math.round(size * 4.5)}
        style={{ display: 'block' }}
        draggable={false}
      />
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
