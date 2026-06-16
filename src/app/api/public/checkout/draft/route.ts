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

    if (isNewCheckoutFlowEnabled()) {
      const data = parseResult.data;
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
      return NextResponse.json({ success: true, ...result });
    }

    const {
      name,
      email,
      phone,
      countryCode,
      countryName,
      experienceLevel,
      services,
      packageSlug,
      preferredGateway,
    } = parseResult.data;

    const pricing = await calculatePricing({
      experienceLevel,
      services: services as ServiceSlug[],
      packageSlug,
      countryCode,
      countryName,
      preferredGateway,
    });

    const isIndia = countryCode.toUpperCase() === 'IN';
    const paymentGateway = isIndia ? 'RAZORPAY' : preferredGateway || 'PAYPAL';

    const { invoice, paymentUrl } = await db.$transaction(async (tx) => {
      let contact = await tx.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });

      if (!contact) {
        contact = await createWithGeneratedDisplayId(
          'displayId',
          () => nextContactDisplayId(tx),
          (displayId) =>
            tx.contact.create({
              data: {
                displayId,
                name,
                email,
                phone,
                country: countryCode,
                contactSource: 'WEBSITE',
                flywheelProfile: {
                  create: {
                    lifecycleStage: 'LEAD',
                    leadStatus: 'NEW',
                    createdAt: new Date(),
                  },
                },
              },
            })
        );
      }

      const count = await tx.invoice.count();
      const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

      const formatTitleCase = (str: string) => {
        if (!str) return '';
        return str
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      const lineItems = pricing.services.map((s) => ({
        id: crypto.randomUUID(),
        description: `${formatTitleCase(s.slug)} (${formatTitleCase(experienceLevel)})`,
        qty: 1,
        unitPrice: s.price,
        lineTotal: s.price,
      }));

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientName: name,
          clientEmail: email,
          clientPhone: phone,
          clientType: experienceLevel,
          country: countryCode,
          currency: pricing.currency,
          currencySymbol: pricing.currencySymbol,
          exchangeRate: 1,
          lineItems: lineItems as object[],
          discountRate: pricing.discountRate,
          discountAmount: pricing.discountAmount,
          taxRate: pricing.taxRate,
          taxAmount: pricing.taxAmount,
          subtotalConverted: pricing.subtotal,
          processingFeeRate: 0,
          processingFeeConverted: pricing.internalGatewayFee,
          totalPayable: pricing.finalPayable,
          paymentGateway,
          status: 'PENDING',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          brandId: 'catalyst',
        },
      });

      let finalPaymentUrl = '';
      const fakeInvoiceData: Record<string, unknown> = { ...newInvoice };

      if (paymentGateway === 'RAZORPAY') {
        try {
          const rpRes = await createRazorpayPaymentLink(fakeInvoiceData as never);
          finalPaymentUrl = rpRes.short_url;
          await tx.invoice.update({
            where: { id: newInvoice.id },
            data: { razorpayLinkId: rpRes.id, razorpayLinkUrl: finalPaymentUrl },
          });
        } catch (rpError) {
          console.error('Razorpay Gateway Error:', rpError);
          throw new Error('Unable to create Razorpay payment link. Please try again.');
        }
      } else {
        try {
          const ppRes = await createPaypalInvoice({
            id: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            clientName: newInvoice.clientName,
            clientEmail: newInvoice.clientEmail,
            currency: newInvoice.currency,
            dueDate: newInvoice.dueDate,
            notes: `Draft Checkout for ${packageSlug}`,
            lineItems,
            taxAmount: pricing.taxAmount,
            discountAmount: pricing.discountAmount,
            processingFeeAmount: pricing.internalGatewayFee,
          });
          finalPaymentUrl = ppRes.paymentUrl;
          await tx.invoice.update({
            where: { id: newInvoice.id },
            data: { paypalInvoiceId: ppRes.id, paypalPaymentUrl: finalPaymentUrl },
          });
        } catch (ppError) {
          console.error('PayPal Gateway Error:', ppError);
          throw new Error('Unable to create PayPal invoice. Please try again.');
        }
      }

      return { invoice: newInvoice, paymentUrl: finalPaymentUrl, lineItems };
    });

    if (email && paymentUrl) {
      try {
        const fullInvoice = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
        await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      } catch (e) {
        console.error('Failed to send legacy checkout invoice email:', e);
      }
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      paymentUrl,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      discountRate: pricing.discountRate,
      taxAmount: pricing.taxAmount,
      taxRate: pricing.taxRate,
      finalPayable: pricing.finalPayable,
      currency: pricing.currency,
      currencySymbol: pricing.currencySymbol,
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
