import type { Prisma } from '@prisma/client';
import { ClientType } from '@prisma/client';
import { prisma as db } from '@/lib/db';
import {
  calculatePricing,
  type PackageSlug,
  type ServiceSlug,
} from '@/lib/pricing-v2';
import {
  deriveExperienceLevel,
  resolveSelfServiceServices,
  validateSelfServiceCheckout,
} from '@/lib/catalog/self-service';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { createPaypalInvoice } from '@/lib/paypal';
import { sendInvoiceEmail } from '@/lib/email';
import { createWithGeneratedDisplayId, nextContactDisplayId } from '@/lib/displayIds';
import {
  inquiryStatusToLeadStatus,
  inquiryStatusToLifecycleStage,
} from '@/lib/flywheel/inquiryStatusMap';

export interface CheckoutSessionInput {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  countryName: string;
  packageSlug: PackageSlug;
  services?: ServiceSlug[];
  tierHint?: ClientType;
  preferredGateway?: 'RAZORPAY' | 'PAYPAL';
}

function formatTitleCase(str: string) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export async function createCheckoutSession(input: CheckoutSessionInput) {
  const services = resolveSelfServiceServices(input.packageSlug, input.services ?? []);
  const experienceLevel = deriveExperienceLevel(input.packageSlug, input.tierHint);

  const validation = validateSelfServiceCheckout({
    packageSlug: input.packageSlug,
    services,
    experienceLevel,
  });
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid checkout');
  }

  const pricing = await calculatePricing({
    experienceLevel,
    services,
    packageSlug: input.packageSlug,
    countryCode: input.countryCode,
    countryName: input.countryName,
    preferredGateway: input.preferredGateway,
  });

  const isIndia = input.countryCode.toUpperCase() === 'IN';
  const paymentGateway = isIndia ? 'RAZORPAY' : (input.preferredGateway || 'PAYPAL');

  const result = await db.$transaction(async (tx) => {
    let contact = await tx.contact.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      include: { flywheelProfile: true },
    });

    if (!contact) {
      contact = await createWithGeneratedDisplayId(
        'displayId',
        () => nextContactDisplayId(tx),
        (displayId) =>
          tx.contact.create({
            data: {
              displayId,
              name: input.name,
              email: input.email.toLowerCase().trim(),
              phone: input.phone,
              country: input.countryCode,
              contactSource: 'WEBSITE_CHECKOUT',
              flywheelProfile: {
                create: {
                  lifecycleStage: 'LEAD',
                  leadStatus: 'NEW',
                  dealValue: pricing.finalPayable,
                },
              },
            },
            include: { flywheelProfile: true },
          })
      );
    } else if (contact.flywheelProfile) {
      await tx.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: {
          dealValue: pricing.finalPayable,
          leadStatus: inquiryStatusToLeadStatus('NEW'),
          lifecycleStage: inquiryStatusToLifecycleStage('NEW'),
        },
      });
    }

    const session = await tx.checkoutSession.create({
      data: {
        channel: 'CHECKOUT',
        contactId: contact?.id,
        packageSlug: input.packageSlug,
        services: services as unknown as Prisma.InputJsonValue,
        experienceLevel,
        pricingSnapshot: pricing as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        name: input.name,
        email: input.email.toLowerCase().trim(),
        phone: input.phone,
        countryCode: input.countryCode,
        countryName: input.countryName,
      },
    });

    const count = await tx.invoice.count();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

    const lineItems = pricing.services.map((s) => ({
      id: crypto.randomUUID(),
      description: `${formatTitleCase(s.slug)} (${formatTitleCase(experienceLevel)})`,
      qty: 1,
      unitPrice: s.price,
      lineTotal: s.price,
    }));

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientName: input.name,
        clientEmail: input.email.toLowerCase().trim(),
        clientPhone: input.phone,
        clientType: experienceLevel,
        country: input.countryCode,
        currency: pricing.currency,
        currencySymbol: pricing.currencySymbol,
        exchangeRate: 1,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
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
        sourceChannel: 'CHECKOUT',
        checkoutSessionId: session.id,
      },
    });

    return { invoice, session, pricing, lineItems };
  });

  let paymentUrl = '';
  if (paymentGateway === 'RAZORPAY') {
    try {
      const rpRes = await createRazorpayPaymentLink({ ...result.invoice, lineItems: result.lineItems } as never);
      paymentUrl = rpRes.short_url;
      await db.invoice.update({
        where: { id: result.invoice.id },
        data: { razorpayLinkId: rpRes.id, razorpayLinkUrl: paymentUrl },
      });
    } catch (e) {
      console.error('Razorpay Gateway Error:', e);
      throw new Error('Unable to create Razorpay payment link. Please try again.');
    }
  } else {
    try {
      const ppRes = await createPaypalInvoice({
        id: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        clientName: result.invoice.clientName,
        clientEmail: result.invoice.clientEmail,
        currency: result.invoice.currency,
        dueDate: result.invoice.dueDate,
        notes: `Self-service checkout: ${input.packageSlug}`,
        lineItems: result.lineItems,
        taxAmount: result.pricing.taxAmount,
        discountAmount: result.pricing.discountAmount,
        processingFeeAmount: result.pricing.internalGatewayFee,
      });
      paymentUrl = ppRes.paymentUrl;
      await db.invoice.update({
        where: { id: result.invoice.id },
        data: { paypalInvoiceId: ppRes.id, paypalPaymentUrl: paymentUrl },
      });
    } catch (e) {
      console.error('PayPal Gateway Error:', e);
      throw new Error('Unable to create PayPal invoice. Please try again.');
    }
  }

  await db.checkoutSession.update({
    where: { id: result.session.id },
    data: {
      invoiceId: result.invoice.id,
      paymentUrl,
      status: 'INVOICE_CREATED',
    },
  });

  const fullInvoice = await db.invoice.findUniqueOrThrow({ where: { id: result.invoice.id } });

  if (fullInvoice.clientEmail && paymentUrl) {
    try {
      await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
    } catch (e) {
      console.error('Failed to send checkout invoice email:', e);
    }
  }

  return {
    invoiceId: fullInvoice.id,
    checkoutSessionId: result.session.id,
    paymentUrl: paymentUrl,
    subtotal: result.pricing.subtotal,
    discountAmount: result.pricing.discountAmount,
    discountRate: result.pricing.discountRate,
    taxAmount: result.pricing.taxAmount,
    taxRate: result.pricing.taxRate,
    finalPayable: result.pricing.finalPayable,
    currency: result.pricing.currency,
    currencySymbol: result.pricing.currencySymbol,
  };
}
