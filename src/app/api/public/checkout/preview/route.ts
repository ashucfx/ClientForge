// Price preview — calculates the full breakdown without creating any DB records.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculatePricing, type PackageSlug, type ServiceSlug } from '@/lib/pricing-v2';
import { deriveExperienceLevel, resolveSelfServiceServices } from '@/lib/catalog/self-service';
import { ClientType } from '@prisma/client';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';

const VALID_SERVICE_SLUGS = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'] as const;

const PreviewSchema = z.object({
  packageSlug:      z.enum(['CAREER_BOOSTER', 'PREMIUM_PLUS', 'CUSTOM']),
  services:         z.array(z.enum(VALID_SERVICE_SLUGS)).min(1),
  countryCode:      z.string().length(2),
  countryName:      z.string().min(2),
  tierHint:         z.nativeEnum(ClientType).optional(),
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await enforcePublicRateLimit(req, {
    action: 'checkout_preview',
    ipLimit: { limit: 30, windowMs: 60 * 60 * 1000 },
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { packageSlug, countryCode, countryName, tierHint, preferredGateway } = parsed.data;
  const services = resolveSelfServiceServices(packageSlug as PackageSlug, parsed.data.services as ServiceSlug[]);
  const experienceLevel = deriveExperienceLevel(packageSlug as PackageSlug, tierHint);

  const pricing = await calculatePricing({
    experienceLevel,
    services,
    packageSlug: packageSlug as PackageSlug,
    countryCode,
    countryName,
    preferredGateway,
  });

  return NextResponse.json({
    ok: true,
    currency: pricing.currency,
    currencySymbol: pricing.currencySymbol,
    services: pricing.services,
    complementaryServices: pricing.complementaryServices,
    subtotal: pricing.subtotal,
    discountRate: pricing.discountRate,
    discountAmount: pricing.discountAmount,
    subtotalAfterDiscount: pricing.subtotalAfterDiscount,
    taxRate: pricing.taxRate,
    taxAmount: pricing.taxAmount,
    finalPayable: pricing.finalPayable,
    isIndia: countryCode.toUpperCase() === 'IN',
    gateway: countryCode.toUpperCase() === 'IN' ? 'RAZORPAY' : (preferredGateway ?? 'PAYPAL'),
  });
}
