// src/lib/brand/types.ts
// Brand system for ClientForge — Catalyst TPA only

export type BrandId = 'catalyst';

export interface BrandToken {
  /** Unique identifier */
  id: BrandId;

  /** Display name — "Catalyst" | "Ripple Nexus" */
  name: string;

  /** Short tagline shown under logo */
  tagline: string;

  /** Primary brand colour (hex) */
  primaryColor: string;
  primaryDark: string;
  primaryLight: string; // rgba with low opacity

  /** CSS gradient string for headers / banners */
  gradient: string;

  /** 3px accent bar gradient (used in emails) */
  accentBar: string;

  /** Email body background colour */
  emailBg: string;

  /** Font family for logo wordmark */
  fontSerif: string;

  /** Sender email address */
  fromEmail: string;
  replyTo: string;

  /** Public website */
  websiteUrl: string;
  websiteLabel: string;

  /** Client portal base URL */
  portalUrl: string;

  /** Email-safe HTML logo — returns inline-table HTML string */
  logoEmailHtml: (size: number) => string;

  /** Footer legal line for emails */
  footerLegal: string;
}
