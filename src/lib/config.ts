// src/lib/config.ts — single source of truth for env-driven constants

export const BRAND_EMAIL = 'catalyst@theripplenexus.com';
export const BRAND_WEBSITE_LABEL = 'catalyst.theripplenexus.com';
export const BRAND_WEBSITE_URL = `https://${BRAND_WEBSITE_LABEL}`;

export const PORTAL_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_APP_URL ?? BRAND_WEBSITE_URL).replace(/\/$/, '');

export const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL ?? BRAND_EMAIL;
