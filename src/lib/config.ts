// src/lib/config.ts — single source of truth for env-driven constants

// ── Catalyst (sub-brand — career services) ───────────────────────────────────
// These exports are UNCHANGED — all existing code keeps working as-is
export const BRAND_EMAIL = 'catalyst@theripplenexus.com';
export const BRAND_WEBSITE_LABEL = 'catalyst.theripplenexus.com';
export const BRAND_WEBSITE_URL = `https://${BRAND_WEBSITE_LABEL}`;

export const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? BRAND_WEBSITE_URL).replace(/\/$/, '');

export const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL ?? BRAND_EMAIL;

// ── Ripple Nexus (parent brand — agency services) ────────────────────────────
// NEW exports — not referenced by any existing code yet
export const RN_EMAIL         = process.env.RN_FROM_EMAIL  ?? 'hello@theripplenexus.com';
export const RN_WEBSITE_URL   = 'https://theripplenexus.com';
export const RN_WEBSITE_LABEL = 'theripplenexus.com';
export const RN_PORTAL_URL    =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.RN_PORTAL_URL ?? 'https://clientforge.theripplenexus.com').replace(/\/$/, '');
export const RN_ADMIN_EMAIL   = process.env.RN_ADMIN_NOTIFY_EMAIL ?? RN_EMAIL;
