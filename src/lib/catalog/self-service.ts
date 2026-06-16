import { ClientType } from '@prisma/client';
import type { PackageSlug, ServiceSlug } from '@/lib/pricing-v2';

export const SELF_SERVICE_PACKAGES: Record<
  Exclude<PackageSlug, never>,
  { services: ServiceSlug[]; tiers: ClientType[]; label: string; description: string; features: string[] }
> = {
  CAREER_BOOSTER: {
    services: ['RESUME', 'LINKEDIN', 'COVER_LETTER'],
    tiers: ['FRESHER', 'MID_CAREER'],
    label: 'Career Booster',
    description: 'Resume + LinkedIn + Cover Letter',
    features: ['ATS-Optimized Resume', 'LinkedIn Profile Makeover', 'Targeted Cover Letter', '1 Revision Round'],
  },
  PREMIUM_PLUS: {
    services: ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'],
    tiers: ['FRESHER', 'MID_CAREER'],
    label: 'Premium Plus',
    description: 'All four career services',
    features: ['Everything in Career Booster', 'Custom Personal Portfolio Website', 'Priority Delivery', '2 Revision Rounds'],
  },
  CUSTOM: {
    services: ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'],
    tiers: ['FRESHER', 'MID_CAREER'],
    label: 'Build Your Own',
    description: 'Pick individual services',
    features: ['Select only what you need', 'A la carte pricing', 'Standard delivery timeline'],
  },
};

export const INQUIRE_ONLY_REQUIREMENT_TYPES = [
  'EXECUTIVE_RESUME',
  'CONSULTING',
  'OTHER',
] as const;

export type InquireRequirementType = (typeof INQUIRE_ONLY_REQUIREMENT_TYPES)[number];

export const INQUIRE_SERVICES = [
  { id: 'EXECUTIVE_RESUME', label: 'Executive Resume', sub: 'C-suite and senior leadership positioning' },
  { id: 'LINKEDIN_EXECUTIVE', label: 'Executive LinkedIn', sub: 'Authority-building profile strategy' },
  { id: 'CONSULTING', label: 'Career Consulting', sub: 'Complex career transitions and strategy' },
] as const;

export function deriveExperienceLevel(packageSlug: PackageSlug, tierHint?: ClientType): ClientType {
  if (tierHint && SELF_SERVICE_PACKAGES[packageSlug].tiers.includes(tierHint)) {
    return tierHint;
  }
  return 'MID_CAREER';
}

export function resolveSelfServiceServices(
  packageSlug: PackageSlug,
  customServices: ServiceSlug[] = []
): ServiceSlug[] {
  if (packageSlug === 'CUSTOM') {
    return customServices;
  }
  return SELF_SERVICE_PACKAGES[packageSlug].services;
}

export function validateSelfServiceCheckout(input: {
  packageSlug: PackageSlug;
  services: ServiceSlug[];
  experienceLevel: ClientType;
}): { valid: boolean; error?: string } {
  const pkg = SELF_SERVICE_PACKAGES[input.packageSlug];
  if (!pkg.tiers.includes(input.experienceLevel)) {
    return {
      valid: false,
      error: 'Executive packages require a consultation. Please use /inquire instead.',
    };
  }

  const resolved = resolveSelfServiceServices(input.packageSlug, input.services);
  if (resolved.length === 0) {
    return { valid: false, error: 'Select at least one service.' };
  }

  if (input.packageSlug === 'CUSTOM') {
    const allowed = new Set(pkg.services);
    for (const s of resolved) {
      if (!allowed.has(s)) {
        return { valid: false, error: `Service ${s} is not available for self-service checkout.` };
      }
    }
  }

  return { valid: true };
}
