// src/lib/career/services.ts
// Shared service resolution — used by admin route + webhook

import { prisma as db } from '@/lib/db';
import type { CareerServiceSlug } from './types';

export const SERVICE_DEFAULTS: Record<CareerServiceSlug, { name: string; formType: string | null }> = {
  RESUME:            { name: 'Resume Rewrite',                 formType: 'career_profile'   },
  COVER_LETTER:      { name: 'Cover Letter',                   formType: 'career_profile'   },
  LINKEDIN:          { name: 'LinkedIn Profile Optimization',  formType: 'linkedin_profile' },
  PORTFOLIO:         { name: 'Portfolio Website',              formType: 'portfolio_website'},
  FULL_PACKAGE:      { name: 'Career Booster Package',         formType: null               },
  PREMIUM_PLUS:      { name: 'Premium Plus Package',           formType: null               },
  EXECUTIVE_CONNECT: { name: 'Executive Connect',              formType: null               },
};

/**
 * Canonical component decomposition for packages:
 * 1. Career Booster Package: Resume Rewrite + LinkedIn Profile Optimization + Cover Letter
 * 2. Premium Plus Package: Resume Rewrite + LinkedIn Profile Optimization + Cover Letter + Portfolio Website
 */
export const PACKAGE_COMPONENTS: Record<string, { slug: CareerServiceSlug; name: string }[]> = {
  FULL_PACKAGE: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
    { slug: 'COVER_LETTER', name: 'Cover Letter' },
  ],
  FULL: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
    { slug: 'COVER_LETTER', name: 'Cover Letter' },
  ],
  BOOSTER: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
    { slug: 'COVER_LETTER', name: 'Cover Letter' },
  ],
  PREMIUM_PLUS: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
    { slug: 'COVER_LETTER', name: 'Cover Letter' },
    { slug: 'PORTFOLIO',    name: 'Portfolio Website' },
  ],
  EXECUTIVE_PLUS: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
    { slug: 'COVER_LETTER', name: 'Cover Letter' },
    { slug: 'PORTFOLIO',    name: 'Portfolio Website' },
  ],
  EXECUTIVE: [
    { slug: 'RESUME',       name: 'Resume Rewrite' },
    { slug: 'LINKEDIN',     name: 'LinkedIn Profile Optimization' },
  ],
};

/**
 * Expands any bundle slugs (e.g. FULL_PACKAGE, PREMIUM_PLUS) into their constituent component service slugs.
 */
export function expandServiceSlugs(slugs: (CareerServiceSlug | string)[]): CareerServiceSlug[] {
  const result = new Set<CareerServiceSlug>();
  for (const s of slugs) {
    if (s === 'FULL_PACKAGE' || s === 'FULL' || s === 'BOOSTER') {
      result.add('RESUME');
      result.add('LINKEDIN');
      result.add('COVER_LETTER');
    } else if (s === 'PREMIUM_PLUS' || s === 'EXECUTIVE_PLUS') {
      result.add('RESUME');
      result.add('LINKEDIN');
      result.add('COVER_LETTER');
      result.add('PORTFOLIO');
    } else if (s === 'EXECUTIVE') {
      result.add('RESUME');
      result.add('LINKEDIN');
    } else if (s in SERVICE_DEFAULTS) {
      result.add(s as CareerServiceSlug);
    }
  }
  return Array.from(result);
}

/**
 * Expands a client's services array to ensure each component is broken out individually
 * with 2 revisions tracked per component, and 'Full Career Package' is never displayed.
 */
export function expandClientServices(
  services: { slug: string; name: string }[],
  packageType?: string | null
): { slug: string; name: string }[] {
  const result: { slug: string; name: string }[] = [];
  const seen = new Set<string>();

  const add = (slug: string, name: string) => {
    if (!seen.has(slug)) {
      seen.add(slug);
      result.push({ slug, name });
    }
  };

  for (const s of services) {
    if (PACKAGE_COMPONENTS[s.slug]) {
      for (const comp of PACKAGE_COMPONENTS[s.slug]) {
        add(comp.slug, comp.name);
      }
    } else if (s.slug !== 'FULL_PACKAGE' && s.slug !== 'PREMIUM_PLUS') {
      const canonicalName = SERVICE_DEFAULTS[s.slug as CareerServiceSlug]?.name ?? s.name;
      add(s.slug, canonicalName);
    }
  }

  // If services was empty or only held legacy packageType
  if (result.length === 0 && packageType && PACKAGE_COMPONENTS[packageType]) {
    for (const comp of PACKAGE_COMPONENTS[packageType]) {
      add(comp.slug, comp.name);
    }
  }

  // Default fallback if still empty: standard Career Booster Package components
  if (result.length === 0) {
    add('RESUME', 'Resume Rewrite');
    add('LINKEDIN', 'LinkedIn Profile Optimization');
    add('COVER_LETTER', 'Cover Letter');
  }

  return result;
}

/**
 * Migrates a client's DB relation from legacy bundle slugs (FULL_PACKAGE / PREMIUM_PLUS)
 * to atomic component service rows. Idempotent.
 */
export async function migrateClientToComponentServices(
  clientId: string,
  expandedServices: { slug: string; name: string }[]
): Promise<void> {
  try {
    const componentSlugs = expandedServices.map(s => s.slug as CareerServiceSlug);
    const serviceRecords = await resolveServices(componentSlugs);

    // Upsert each component service relation
    for (const sRec of serviceRecords) {
      await db.careerClientService.upsert({
        where: {
          clientId_serviceId: {
            clientId,
            serviceId: sRec.id,
          },
        },
        create: {
          clientId,
          serviceId: sRec.id,
          status: 'NOT_STARTED',
        },
        update: {},
      });
    }

    // Delete legacy bundle rows (FULL_PACKAGE, PREMIUM_PLUS) from client services
    const bundleServices = await db.careerService.findMany({
      where: { slug: { in: ['FULL_PACKAGE', 'PREMIUM_PLUS'] } },
      select: { id: true },
    });
    const bundleServiceIds = bundleServices.map(b => b.id);
    if (bundleServiceIds.length > 0) {
      await db.careerClientService.deleteMany({
        where: {
          clientId,
          serviceId: { in: bundleServiceIds },
        },
      });
    }

    // If client had revisions with serviceSlug 'FULL_PACKAGE' or null, reassign to 'RESUME'
    await db.careerRevision.updateMany({
      where: {
        clientId,
        serviceSlug: { in: ['FULL_PACKAGE', 'PREMIUM_PLUS', 'GENERAL'] },
      },
      data: { serviceSlug: 'RESUME' },
    });
  } catch (err) {
    console.error(`[services] Migration error for client ${clientId}:`, err);
  }
}

/** Upsert CareerService rows and return their DB records */
export async function resolveServices(slugs: CareerServiceSlug[]) {
  const expanded = expandServiceSlugs(slugs);
  return Promise.all(
    expanded.map(slug =>
      db.careerService.upsert({
        where: { slug },
        create: { slug, ...SERVICE_DEFAULTS[slug] },
        update: { name: SERVICE_DEFAULTS[slug].name },
      }),
    ),
  );
}
