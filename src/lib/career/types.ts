// src/lib/career/types.ts

export type CareerPackage = 'RESUME' | 'LINKEDIN' | 'COVER_LETTER' | 'FULL';
export type CareerStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'UNDER_PROCESS'
  | 'DRAFT_SENT'
  | 'REVISION_REQUESTED'
  | 'COMPLETED';

export type EmailTrigger =
  | 'WELCOME'
  | 'FORM_CONFIRM'
  | 'DRAFT_READY'
  | 'LINKEDIN_DRAFT'
  | 'REVISED_DRAFT'
  | 'REVISION'
  | 'FINAL_DELIVERY'
  | 'LINKEDIN_SECURITY'
  | 'MESSAGE_NOTIFY'
  | 'DELETE_OTP';

// New form types matching updated brief names
export type FormType = 'career_profile' | 'linkedin_profile' | 'portfolio_website';

// Service slugs — matches CareerService.slug in DB
export type CareerServiceSlug =
  | 'RESUME'
  | 'COVER_LETTER'
  | 'LINKEDIN'
  | 'PORTFOLIO'
  | 'FULL_PACKAGE';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'tags' | 'file' | 'url' | 'password' | 'checkbox' | 'rating';
  placeholder?: string;
  hint?: string;
  options?: string[];
  required: boolean;
  accept?: string;
  section?: string;
}

export interface FormSchema {
  formType: FormType;
  title: string;
  description: string;
  fields: FormField[];
  disclaimer: string;
}

export interface CareerClientSafe {
  id: string;
  name: string;
  email: string;
  packageType?: CareerPackage | null;
  services?: { slug: string; name: string }[];
  status: CareerStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DeliverablePublic {
  id: string;
  label: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileCategory: string;
  createdAt: string;
}

export const PACKAGE_LABELS: Record<CareerPackage, string> = {
  RESUME: 'Resume Writing',
  LINKEDIN: 'LinkedIn Optimisation',
  COVER_LETTER: 'Cover Letter',
  FULL: 'Career Booster Package',
};

export const SERVICE_LABELS: Record<CareerServiceSlug, string> = {
  RESUME: 'Resume Writing',
  COVER_LETTER: 'Cover Letter',
  LINKEDIN: 'LinkedIn Optimisation',
  PORTFOLIO: 'Portfolio Website',
  FULL_PACKAGE: 'Career Booster Package',
};

export const STATUS_LABELS: Record<CareerStatus, string> = {
  NOT_STARTED: 'Not Started',
  SUBMITTED: 'Form Submitted',
  UNDER_PROCESS: 'Under Process',
  DRAFT_SENT: 'Draft Sent',
  REVISION_REQUESTED: 'Revision Requested',
  COMPLETED: 'Completed',
};

export const STATUS_ORDER: CareerStatus[] = [
  'NOT_STARTED',
  'SUBMITTED',
  'UNDER_PROCESS',
  'DRAFT_SENT',
  'REVISION_REQUESTED',
  'COMPLETED',
];

// Service slug → which form types it unlocks
// Resume OR Cover Letter both unlock career_profile (shown only once)
export const SERVICE_FORM_MAP: Record<CareerServiceSlug, FormType[]> = {
  RESUME:        ['career_profile'],
  COVER_LETTER:  ['career_profile'],
  LINKEDIN:      ['linkedin_profile'],
  PORTFOLIO:     ['portfolio_website'],
  FULL_PACKAGE:  ['career_profile', 'linkedin_profile'],
};

// Legacy: package → forms (kept for backward compat)
export const PACKAGE_FORMS: Record<CareerPackage, FormType[]> = {
  RESUME:       ['career_profile'],
  LINKEDIN:     ['linkedin_profile'],
  COVER_LETTER: ['career_profile'],
  FULL:         ['career_profile', 'linkedin_profile'],
};

// ── Legacy form type compatibility ────────────────────────────────────────────
// Old names stored in DB → canonical new names
export const LEGACY_FORM_ALIAS: Record<string, FormType> = {
  resume:       'career_profile',
  cover_letter: 'career_profile',
  linkedin:     'linkedin_profile',
};

/** Normalize any form type string (old or new) to the canonical FormType */
export function normalizeFormType(raw: string): FormType {
  if (raw in LEGACY_FORM_ALIAS) return LEGACY_FORM_ALIAS[raw];
  return raw as FormType;
}

/** All DB form type strings that map to a canonical FormType */
export function legacyAliasesFor(ft: FormType): string[] {
  return Object.entries(LEGACY_FORM_ALIAS)
    .filter(([, v]) => v === ft)
    .map(([k]) => k);
}

/** Derive unique ordered form types for a list of service slugs */
export function getFormsForServices(slugs: CareerServiceSlug[]): FormType[] {
  const seen = new Set<FormType>();
  const order: FormType[] = ['career_profile', 'linkedin_profile', 'portfolio_website'];
  for (const slug of slugs) {
    for (const ft of SERVICE_FORM_MAP[slug] ?? []) seen.add(ft);
  }
  return order.filter(f => seen.has(f));
}
