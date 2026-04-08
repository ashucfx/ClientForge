// src/components/Logo.tsx
// Exact brand SVG extracted from ripple-nexus-vertical-logo

interface LogoProps {
  /** 'icon' = SVG icon only; 'horizontal' = icon + inline text; 'vertical' = stacked (default full logo) */
  variant?: 'icon' | 'horizontal' | 'vertical';
  size?: number;
  /** Override icon fill for dark/light backgrounds */
  dark?: boolean;
}

export function Logo({ variant = 'horizontal', size = 40, dark = false }: LogoProps) {
  const hub = dark ? '#ffffff' : 'var(--brand)';
  const spoke = dark ? '#ffffff' : 'var(--brand)';
  const spokeOpacity = dark ? 0.7 : 0.6;
  const dot = 'var(--green)';
  // The icon SVG centred at 0,0 — viewBox covers the outermost green dots (74+6.5=80.5) + padding
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="-90 -90 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Centre hub */}
      <circle cx="0" cy="0" r="16" fill={hub} />

      {/* 6 spoke lines + inner nodes at r=42, every 60° */}
      <line x1="0" y1="0" x2="42" y2="0"      stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="42" cy="0" r="9" fill={hub} />

      <line x1="0" y1="0" x2="21" y2="36.37"  stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="21" cy="36.37" r="9" fill={hub} />

      <line x1="0" y1="0" x2="-21" y2="36.37" stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="-21" cy="36.37" r="9" fill={hub} />

      <line x1="0" y1="0" x2="-42" y2="0"     stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="-42" cy="0" r="9" fill={hub} />

      <line x1="0" y1="0" x2="-21" y2="-36.37" stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="-21" cy="-36.37" r="9" fill={hub} />

      <line x1="0" y1="0" x2="21" y2="-36.37" stroke={spoke} strokeWidth="5" strokeOpacity={spokeOpacity} />
      <circle cx="21" cy="-36.37" r="9" fill={hub} />

      {/* 8 green outer dots at r=74, every 45° */}
      <circle cx="74"    cy="0"     r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="52.33" cy="52.33" r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="0"     cy="74"    r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="-52.33" cy="52.33" r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="-74"   cy="0"     r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="-52.33" cy="-52.33" r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="0"     cy="-74"   r="6.5" fill={dot} fillOpacity="0.88" />
      <circle cx="52.33" cy="-52.33" r="6.5" fill={dot} fillOpacity="0.88" />
    </svg>
  );

  if (variant === 'icon') return icon;

  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-2.5" aria-label="Ripple Nexus">
        {icon}
        <div>
          <div
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, fontSize: size * 0.52 }}
            className={dark ? 'text-white' : 'text-[#1a1a1a]'}
          >
            Ripple<span style={{ color: '#1f56d4', fontWeight: 300 }}>Nexus</span>
          </div>
        </div>
      </div>
    );
  }

  // vertical
  return (
    <div className="flex flex-col items-center gap-2" aria-label="Ripple Nexus">
      {icon}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 700, fontSize: size * 0.45, letterSpacing: '-0.5px' }}
          className={dark ? 'text-white' : 'text-[#1a1a1a]'}>
          Ripple
        </div>
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 300, fontSize: size * 0.45, letterSpacing: '1px', color: '#1f56d4' }}>
          Nexus
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar variant (white icon + white text) ───────────────
export function LogoSidebar({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Ripple Nexus">
      <svg
        width={size}
        height={size}
        viewBox="-90 -90 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="0" cy="0" r="16" fill="white" />
        <line x1="0" y1="0" x2="42" y2="0"       stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="42" cy="0" r="9" fill="white" />
        <line x1="0" y1="0" x2="21" y2="36.37"   stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="21" cy="36.37" r="9" fill="white" />
        <line x1="0" y1="0" x2="-21" y2="36.37"  stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="-21" cy="36.37" r="9" fill="white" />
        <line x1="0" y1="0" x2="-42" y2="0"      stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="-42" cy="0" r="9" fill="white" />
        <line x1="0" y1="0" x2="-21" y2="-36.37" stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="-21" cy="-36.37" r="9" fill="white" />
        <line x1="0" y1="0" x2="21" y2="-36.37"  stroke="white" strokeWidth="5" strokeOpacity="0.7" />
        <circle cx="21" cy="-36.37" r="9" fill="white" />
        {/* Green outer dots */}
        <circle cx="74"    cy="0"     r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="52.33" cy="52.33" r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="0"     cy="74"    r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="-52.33" cy="52.33" r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="-74"   cy="0"     r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="-52.33" cy="-52.33" r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="0"     cy="-74"   r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
        <circle cx="52.33" cy="-52.33" r="6.5" fill="#3FBD8B" fillOpacity="0.9" />
      </svg>
      <div>
        <div style={{
          fontFamily: 'system-ui,-apple-system,sans-serif',
          fontWeight: 700,
          fontSize: size * 0.52,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          color: 'white',
        }}>
          Ripple<span style={{ color: '#3FBD8B', fontWeight: 300 }}>Nexus</span>
        </div>
        <div style={{ fontSize: size * 0.28, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: '0.5px' }}>
          ClientForge
        </div>
      </div>
    </div>
  );
}
