import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSalesInquiry } from '@/lib/sales/inquiryService';
import { isNewInquireFlowEnabled } from '@/lib/features';
import { INQUIRE_ONLY_REQUIREMENT_TYPES, INQUIRE_SERVICES } from '@/lib/catalog/self-service';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';
import { validatePublicFormMeta } from '@/lib/publicForms';
import { acquireLock } from '@/lib/idempotency';

const INQUIRE_SERVICE_IDS = INQUIRE_SERVICES.map((service) => service.id) as [string, ...string[]];

const InquireSchemaV2 = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  countryCode: z.string().length(2),
  countryName: z.string().min(2),
  requirementType: z.enum(INQUIRE_ONLY_REQUIREMENT_TYPES as unknown as [string, ...string[]]),
  servicesRequested: z.array(z.enum(INQUIRE_SERVICE_IDS)).min(1),
  requirementNotes: z.string().max(5000).optional(),
  sourceUrl: z.string().url().optional(),
  website: z.string().max(0).optional(),
  startedAt: z.number(),
});

const LegacyInquireSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(5).max(20),
  countryCode: z.string().length(2),
  countryName: z.string().min(2),
  experienceLevel: z.string(),
  services: z.array(z.string()).min(1),
  packageSlug: z.enum(['CAREER_BOOSTER', 'PREMIUM_PLUS', 'CUSTOM']),
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const useV2 = isNewInquireFlowEnabled() || Boolean(body.requirementType);

    if (useV2) {
      const parsed = InquireSchemaV2.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid payload', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const metaError = validatePublicFormMeta(parsed.data);
      if (metaError) {
        return NextResponse.json({ error: metaError }, { status: 400 });
      }

      const limited = await enforcePublicRateLimit(req, {
        action: 'sales_inquiry',
        email: parsed.data.email,
        ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
        emailLimit: { limit: 3, windowMs: 60 * 60 * 1000 },
      });
      if (limited) return limited;

      const lockKey = `inquire_${parsed.data.email.toLowerCase()}`;
      if (!acquireLock(lockKey, 10000)) {
        return NextResponse.json({ error: 'Inquiry already processing. Please wait a moment.' }, { status: 409 });
      }

      const inquiry = await createSalesInquiry(parsed.data);
      return NextResponse.json({
        success: true,
        message: 'Consultation request received',
        inquiryId: inquiry.id,
        displayId: inquiry.displayId,
      });
    }

    const legacyParsed = LegacyInquireSchema.safeParse(body);
    if (legacyParsed.success) {
      const limited = await enforcePublicRateLimit(req, {
        action: 'legacy_sales_inquiry',
        email: legacyParsed.data.email,
        ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
        emailLimit: { limit: 3, windowMs: 60 * 60 * 1000 },
      });
      if (limited) return limited;
    }

    const { POST: legacyPost } = await import('./legacyHandler');
    return legacyPost(req, body);
  } catch (error) {
    console.error('Inquire Submit Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
