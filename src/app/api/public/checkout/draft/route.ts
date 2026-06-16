import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma as db } from '@/lib/db';
import { calculatePricing, PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { createPaypalInvoice } from '@/lib/paypal';
import { sendInvoiceEmail } from '@/lib/email';
import { isNewCheckoutFlowEnabled } from '@/lib/features';
import { createCheckoutSession } from '@/lib/sales/checkoutService';
import { enforcePublicRateLimit } from '@/lib/publicRateLimit';
import { validatePublicFormMeta } from '@/lib/publicForms';
import { createWithGeneratedDisplayId, nextContactDisplayId } from '@/lib/displayIds';
import { acquireLock } from '@/lib/idempotency';
import { z } from 'zod';

const CheckoutSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is too short').max(20),
  countryCode: z.string().length(2, 'Invalid country code'),
  countryName: z.string().min(2),
  experienceLevel: z.nativeEnum(ClientType),
  services: z.array(z.string()).min(1, 'Select at least one service'),
  packageSlug: z.enum(['CAREER_BOOSTER', 'PREMIUM_PLUS', 'CUSTOM']),
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional(),
  website: z.string().max(0).optional(),
  startedAt: z.number().optional(),
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

    const limited = await enforcePublicRateLimit(req, {
      action: 'checkout_draft',
      email: parseResult.data.email,
      ipLimit: { limit: 10, windowMs: 60 * 60 * 1000 },
      emailLimit: { limit: 3, windowMs: 60 * 60 * 1000 },
    });
    if (limited) return limited;

    const lockKey = `checkout_${parseResult.data.email.toLowerCase()}`;
    if (!acquireLock(lockKey, 10000)) {
      return NextResponse.json({ error: 'Checkout already processing. Please wait a moment.' }, { status: 409 });
    }

    const metaError = validatePublicFormMeta(parseResult.data);
    if (metaError) {
      return NextResponse.json({ error: metaError }, { status: 400 });
    }

    const data = parseResult.data;
    
    // REROUTE: All self-service checkouts now natively use the session-based architecture
    const result = await createCheckoutSession({
      name: data.name,
      email: data.email,
      phone: data.phone,
      countryCode: data.countryCode,
      countryName: data.countryName,
      packageSlug: data.packageSlug as PackageSlug,
      services: data.services as ServiceSlug[],
      tierHint: data.experienceLevel,
      preferredGateway: data.preferredGateway,
    });
    
    // We return checkoutSessionId which the frontend uses to redirect to /checkout/session/[id]
    return NextResponse.json({ 
      success: true, 
      checkoutSessionId: result.checkoutSessionId 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    if (message.includes('Unable to create')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Draft Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
