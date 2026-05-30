// src/lib/brand/types.ts
// Brand system for ClientForge — supports Catalyst (sub-brand) + Ripple Nexus (parent brand)
// This file is NEW — it does not modify any existing file.

export type BrandId = 'catalyst' | 'ripple_nexus';

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
