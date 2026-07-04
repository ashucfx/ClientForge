import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { createCheckoutSession } from '@/lib/sales/checkoutService';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';
import { validatePublicFormMeta } from '@/lib/publicForms';
import { acquireLockDurable, releaseLockDurable } from '@/lib/idempotency';
import { z } from 'zod';

const VALID_SERVICE_SLUGS = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'] as const;

const CheckoutSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number is too short').max(20),
  countryCode: z.string().length(2, 'Invalid country code'),
  countryName: z.string().min(2),
  experienceLevel: z.nativeEnum(ClientType),
  services: z.array(z.enum(VALID_SERVICE_SLUGS)).min(1, 'Select at least one service'),
  packageSlug: z.enum(['CAREER_BOOSTER', 'PREMIUM_PLUS', 'CUSTOM']),
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional(),
  whatsapp: z.string().max(25).optional(),
  ref: z.string().max(16).optional(),
  website: z.string().max(0).optional(),
  startedAt: z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CheckoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    // Validate meta (stale/bot check) BEFORE acquiring the lock
    const metaError = validatePublicFormMeta(parseResult.data);
    if (metaError) {
      return NextResponse.json({ error: metaError }, { status: 400 });
    }

    const limited = await enforcePublicRateLimit(req, {
      action: 'checkout_draft',
      email: parseResult.data.email,
      ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
      emailLimit: { limit: 3, windowMs: 60 * 60 * 1000 },
    });
    if (limited) return limited;

    const lockKey = `checkout_${parseResult.data.email.toLowerCase()}`;
    // Durable across serverless instances when Upstash Redis is configured,
    // so a double-submit cannot create two invoices / two payment links.
    if (!(await acquireLockDurable(lockKey, 15000))) {
      return NextResponse.json({ error: 'Checkout already processing. Please wait a moment.' }, { status: 409 });
    }

    const data = parseResult.data;

    try {
      const result = await createCheckoutSession({
        name: data.name,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        countryCode: data.countryCode,
        countryName: data.countryName,
        packageSlug: data.packageSlug as PackageSlug,
        services: data.services as ServiceSlug[],
        tierHint: data.experienceLevel,
        preferredGateway: data.preferredGateway,
        referralCode: data.ref,
      });
      await releaseLockDurable(lockKey);
      return NextResponse.json({ success: true, checkoutSessionId: result.checkoutSessionId });
    } catch (innerError) {
      await releaseLockDurable(lockKey);
      throw innerError;
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    if (message.includes('Unable to create')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Draft Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
