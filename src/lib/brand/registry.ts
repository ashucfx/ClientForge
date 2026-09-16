// src/lib/brand/registry.ts
// Central brand registry for ClientForge — Catalyst TPA only.

import type { BrandId, BrandToken } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CATALYST EMAIL LOGO
// Exact replica of the existing LOGO_IMG() function in src/lib/email.ts
// Kept identical so Catalyst invoice emails look byte-for-byte the same
// ─────────────────────────────────────────────────────────────────────────────
function catalystLogoEmailHtml(size: number): string {
  const fontSize  = Math.round(size * 0.62);
  const dotSize   = Math.max(4, Math.round(size * 0.13));
  const dotOffset = Math.max(5, Math.round(size * 0.16));
  return `<table cellpadding="0" cellspacing="0" role="presentation" width="${size}" height="${size}" style="width:${size}px;height:${size}px;background:#0A0B0D;border-radius:8px;border:1px solid rgba(184,147,91,0.35);">
    <tr>
      <td align="center" valign="middle" style="font-family:Georgia,'Times New Roman',serif;font-size:${fontSize}px;line-height:${size}px;font-weight:700;color:#F4F1EB;letter-spacing:0;position:relative;">
        C<span style="display:inline-block;width:${dotSize}px;height:${dotSize}px;background:#B8935B;border-radius:50%;font-size:0;line-height:0;margin-left:-${dotOffset}px;vertical-align:middle;">&nbsp;</span>
      </td>
    </tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND REGISTRY — values sourced directly from official brand guidelines
// ─────────────────────────────────────────────────────────────────────────────
export const BRANDS: Record<BrandId, BrandToken> = {

  // ── CATALYST (sub-brand of Ripple Nexus — career services ONLY) ─────────
  catalyst: {
    id:           'catalyst',
    name:         'Catalyst',
    tagline:      'Career Booster Services',

    // Signal Gold palette — DO NOT change, Catalyst brand system
    primaryColor: '#B8935B',
    primaryDark:  '#9A7540',
    primaryLight: 'rgba(184,147,91,.14)',
    gradient:     'linear-gradient(135deg,#0A0B0D 0%,#B8935B 55%,#1C1812 100%)',
    accentBar:    'linear-gradient(90deg,#B8935B 0%,#D4AF7A 50%,#B8935B 100%)',
    emailBg:      '#F0EDE6',
    fontSerif:    "Georgia,'Times New Roman',serif",

    fromEmail:    process.env.FROM_EMAIL ?? 'catalyst@theripplenexus.com',
    replyTo:      process.env.FROM_EMAIL ?? 'catalyst@theripplenexus.com',
    websiteUrl:   'https://catalyst.theripplenexus.com',
    websiteLabel: 'catalyst.theripplenexus.com',
    portalUrl: (
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : (process.env.CATALYST_PORTAL_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com')
    ).replace(/\/$/, ''),

    logoEmailHtml: catalystLogoEmailHtml,
    footerLegal:  'You received this email because you requested a Career Booster service from Catalyst.',
  },

};


/** Resolve brand token by ID. Always returns Catalyst (only brand). */
export function getBrand(_id?: string | null): BrandToken {
  return BRANDS.catalyst;
}
