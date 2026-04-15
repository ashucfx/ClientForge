// src/lib/career/services.ts
// Shared service resolution — used by admin route + webhook

import { prisma as db } from '@/lib/db';
import type { CareerServiceSlug } from './types';

const SERVICE_DEFAULTS: Record<CareerServiceSlug, { name: string; formType: string | null }> = {
  RESUME:       { name: 'Resume Writing',       formType: 'career_profile'   },
  COVER_LETTER: { name: 'Cover Letter',          formType: 'career_profile'   },
  LINKEDIN:     { name: 'LinkedIn Optimisation', formType: 'linkedin_profile' },
  PORTFOLIO:    { name: 'Portfolio Website',     formType: 'portfolio_website'},
  FULL_PACKAGE: { name: 'Full Career Package',   formType: null               },
};

/** Upsert CareerService rows and return their DB records */
export async function resolveServices(slugs: CareerServiceSlug[]) {
  return Promise.all(
    slugs.map(slug =>
      db.careerService.upsert({
        where: { slug },
        create: { slug, ...SERVICE_DEFAULTS[slug] },
        update: {},
      }),
    ),
  );
}
