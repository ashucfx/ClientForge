// src/lib/career/utils.ts — shared helpers across career API routes

import { SERVICE_LABELS, PACKAGE_LABELS } from '@/lib/career/types';
import type { CareerPackage, CareerServiceSlug } from '@/lib/career/types';

/** Derive a human-readable service label from a client record. */
export function resolvePackageLabel(client: {
  packageType: string | null;
  services: { service: { slug: string; name: string } }[];
}): string {
  if (client.services.length > 0)
    return client.services
      .map(s => SERVICE_LABELS[s.service.slug as CareerServiceSlug] ?? s.service.name)
      .join(', ');
  if (client.packageType)
    return PACKAGE_LABELS[client.packageType as CareerPackage] ?? client.packageType;
  return 'Career Services';
}

/**
 * Retry once on Neon cold-start errors (P1001 / P1017).
 * Use for any DB call that may hit a sleeping Neon free-tier instance.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P1001' || code === 'P1017') {
      await new Promise(r => setTimeout(r, 2000));
      return fn();
    }
    throw err;
  }
}
