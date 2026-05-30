// src/lib/brand/registry.ts
// Central brand registry for ClientForge.
// This file is NEW — it does not modify any existing file.
//
// THE ONE RULE:
//   invoice.brandId === 'catalyst'     → Catalyst branding (career services)
//   invoice.brandId === 'ripple_nexus' → Ripple Nexus branding (agency services)

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
// RIPPLE NEXUS EMAIL LOGO
// Based on the official logo-icon-mark.svg from the RN Brand System.
// Concept: Nexus node (filled circle) + 3 ripple arcs, gradient #7C5CFF→#22D3EE
// Email-safe: uses an inline SVG inside a table cell (renders in Gmail/Apple Mail)
// ─────────────────────────────────────────────────────────────────────────────
function rippleNexusLogoEmailHtml(size: number): string {
  // The Nexus node + 3 ripple arcs — geometry from official logo-icon-mark.svg (64×64 grid)
  const svgInner = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Ripple Nexus"><defs><linearGradient id="rn-em-${size}" x1="0%" y1="0%" x2="100%" y2="50%"><stop offset="0%" stop-color="#7C5CFF"/><stop offset="55%" stop-color="#B794FF"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="#0A0B14"/><circle cx="22" cy="32" r="5" fill="url(#rn-em-${size})"/><path d="M 27 23.34 A 10 10 0 0 1 27 40.66" fill="none" stroke="url(#rn-em-${size})" stroke-width="3" stroke-linecap="round" opacity="1"/><path d="M 34.73 19.27 A 18 18 0 0 1 34.73 44.73" fill="none" stroke="url(#rn-em-${size})" stroke-width="3" stroke-linecap="round" opacity="0.7"/><path d="M 44.52 19 A 26 26 0 0 1 44.52 45" fill="none" stroke="url(#rn-em-${size})" stroke-width="3" stroke-linecap="round" opacity="0.45"/></svg>`;

  return `<table cellpadding="0" cellspacing="0" role="presentation" width="${size}" height="${size}" style="width:${size}px;height:${size}px;"><tr><td align="center" valign="middle" style="padding:0;line-height:0;">${svgInner}</td></tr></table>`;
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

  // ── RIPPLE NEXUS (parent brand — all agency / non-career services) ───────
  // Source: Ripple Nexus Brand System v1.0 · ripple-nexus-brand-guidelines.md
  //
  // Palette: "Sovereign Violet"
  //   • Nexus Violet  #7C5CFF  — primary CTAs, brand gradient origin, link states
  //   • Plasma        #B794FF  — gradient midpoint, highlights, glows
  //   • Ion Cyan      #22D3EE  — gradient end, data accents, micro-accents
  //   • Obsidian      #0A0B14  — page/email background (dark-first)
  //   • Ink           #12141F  — cards, nav, modals
  //   • Pearl         #F4F5FA  — body text on dark
  //
  // Signature gradient: linear-gradient(135deg, #7C5CFF 0%, #B794FF 55%, #22D3EE 100%)
  // Logo: Nexus node (•, r=5 at 22,32) + 3 ripple arcs (r=10/18/26, opacity 1/0.7/0.45)
  // Font: Satoshi Variable 700 (display), Inter Variable (body)
  // Tagline: "AI SYSTEMS THAT RUN THE BUSINESS" (tracked +3, all caps in email eyebrow)
  ripple_nexus: {
    id:           'ripple_nexus',
    name:         'Ripple Nexus',
    tagline:      'AI Systems That Run The Business',

    primaryColor: '#7C5CFF',             // Nexus Violet
    primaryDark:  '#6A47FF',             // hover
    primaryLight: 'rgba(124,92,255,.14)',
    gradient:     'linear-gradient(135deg,#7C5CFF 0%,#B794FF 55%,#22D3EE 100%)',
    accentBar:    'linear-gradient(90deg,#7C5CFF 0%,#B794FF 50%,#22D3EE 100%)',
    emailBg:      '#0A0B14',             // Obsidian — dark-first per brand §1.3
    fontSerif:    "'Satoshi Variable',Inter,ui-sans-serif,system-ui",

    fromEmail:    process.env.RN_FROM_EMAIL ?? 'hello@theripplenexus.com',
    replyTo:      process.env.RN_FROM_EMAIL ?? 'hello@theripplenexus.com',
    websiteUrl:   'https://theripplenexus.com',
    websiteLabel: 'theripplenexus.com',
    portalUrl: (
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : (process.env.RN_PORTAL_URL ?? 'https://clientforge.theripplenexus.com')
    ).replace(/\/$/, ''),

    logoEmailHtml: rippleNexusLogoEmailHtml,
    footerLegal:  'You received this email because you requested a service from Ripple Nexus.',
  },
};

/** Resolve brand token by ID. Defaults to Catalyst if ID is unknown. */
export function getBrand(id?: string | null): BrandToken {
  if (id === 'ripple_nexus') return BRANDS.ripple_nexus;
  return BRANDS.catalyst; // default — keeps all existing behavior unchanged
}
