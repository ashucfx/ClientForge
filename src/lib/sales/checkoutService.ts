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
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import {
  inquiryStatusToLeadStatus,
  inquiryStatusToLifecycleStage,
} from '@/lib/flywheel/inquiryStatusMap';
import { findReferrerByCode, ensureReferralCode } from '@/lib/referral';

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
  referralCode?: string;
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

  // Generate invoice number before the transaction — uses global prisma, not tx
  const invoiceNumber = await getNextInvoiceNumber('INV');

  // Resolve referrer before the transaction (global prisma, not tx)
  const referrer = input.referralCode
    ? await findReferrerByCode(input.referralCode)
    : null;

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
              contactSource: referrer ? 'REFERRAL' : 'WEBSITE_CHECKOUT',
              flywheelProfile: {
                create: {
                  lifecycleStage: 'LEAD',
                  leadStatus: 'NEW',
                  dealValue: pricing.finalPayable,
                  optInStatus: true,
                  optInSource: 'WEBSITE_CHECKOUT',
                  ...(referrer ? { referredById: referrer.id } : {}),
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
        processingFeeRate: pricing.subtotal > 0
          ? Math.round((pricing.internalGatewayFee / pricing.subtotal) * 10000) / 100
          : 0,
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

  // Generate referral code for new contacts + credit the referrer (fire-and-forget)
  if (result.session.contactId) {
    db.flywheelProfile.findUnique({ where: { contactId: result.session.contactId }, select: { id: true } })
      .then((p) => p && ensureReferralCode(p.id))
      .catch(() => null);
  }
  if (referrer) {
    db.flywheelProfile.update({
      where: { id: referrer.id },
      data: { referralScore: { increment: 1 } },
    }).catch(() => null);
  }

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

  // Send invoice email using the already-committed invoice data — no extra DB round-trip
  if (result.invoice.clientEmail && paymentUrl) {
    try {
      await sendInvoiceEmail({
        ...result.invoice,
        paypalPaymentUrl: paymentUrl,
        razorpayLinkUrl: paymentUrl,
      } as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      db.sysEmailLog.create({ data: {
        to: result.invoice.clientEmail,
        subject: `Invoice ${result.invoice.invoiceNumber}`,
        trigger: 'INVOICE_SENT',
        channel: 'resend',
        status: 'sent',
        metadata: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, source: 'checkout' },
      }}).catch(() => {});
    } catch (e) {
      console.error('Failed to send checkout invoice email:', e);
      db.sysEmailLog.create({ data: {
        to: result.invoice.clientEmail,
        subject: `Invoice ${result.invoice.invoiceNumber}`,
        trigger: 'INVOICE_SENT',
        channel: 'resend',
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
        metadata: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, source: 'checkout' },
      }}).catch(() => {});
    }
  }

  return {
    invoiceId: result.invoice.id,
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

/** Derive experience level from requirement type string or fall back to EXECUTIVE */
function resolveExperienceLevel(requirementType: string | null | undefined): ClientType {
  if (!requirementType) return 'EXECUTIVE';
  const upper = requirementType.toUpperCase();
  if (upper.includes('FRESHER') || upper.includes('ENTRY') || upper.includes('JUNIOR')) return 'FRESHER';
  if (upper.includes('MID') || upper.includes('SENIOR') || upper.includes('MANAGER')) return 'MID_CAREER';
  if (upper.includes('EXEC') || upper.includes('DIRECTOR') || upper.includes('VP') || upper.includes('C-LEVEL')) return 'EXECUTIVE';
  if (upper.includes('PLUS') || upper.includes('PREMIUM')) return 'EXECUTIVE_PLUS';
  return 'EXECUTIVE';
}

export async function createCheckoutSessionFromProposal(proposalId: string) {
  const proposal = await db.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { inquiry: { include: { contact: { include: { flywheelProfile: true, careerClients: { orderBy: { createdAt: 'desc' }, take: 1, select: { packageType: true } } } } } } },
  });

  const inquiry = proposal.inquiry;
  const isIndia = inquiry.countryCode.toUpperCase() === 'IN';
  const paymentGateway = isIndia ? 'RAZORPAY' : 'PAYPAL';

  // Derive experience level: existing career package → requirement type → fallback EXECUTIVE
  const existingPackage = inquiry.contact?.careerClients?.[0]?.packageType as ClientType | null;
  const derivedExperienceLevel: ClientType = existingPackage ?? resolveExperienceLevel(inquiry.requirementType);

  // Generate invoice number before the transaction — uses global prisma, not tx
  const invoiceNumber = await getNextInvoiceNumber('INV');

  const result = await db.$transaction(async (tx) => {
    let contact = inquiry.contact;

    if (contact && contact.flywheelProfile) {
      await tx.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: {
          dealValue: proposal.total,
          leadStatus: inquiryStatusToLeadStatus('APPROVED'),
        },
      });
    }

    const session = await tx.checkoutSession.create({
      data: {
        channel: 'CHECKOUT',
        contactId: contact?.id,
        salesInquiryId: inquiry.id,
        proposalId: proposal.id,
        packageSlug: 'CUSTOM_PROPOSAL',
        services: proposal.deliverables as unknown as Prisma.InputJsonValue,
        experienceLevel: derivedExperienceLevel,
        pricingSnapshot: {
          subtotal: proposal.subtotal,
          discountAmount: proposal.discount,
          taxAmount: proposal.tax,
          finalPayable: proposal.total,
          currency: proposal.currency,
          currencySymbol: proposal.currencySymbol,
        } as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        countryCode: inquiry.countryCode,
        countryName: inquiry.countryName,
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientName: inquiry.name,
        clientEmail: inquiry.email.toLowerCase().trim(),
        clientPhone: inquiry.phone ?? '',
        clientType: derivedExperienceLevel,
        country: inquiry.countryCode,
        currency: proposal.currency,
        currencySymbol: proposal.currencySymbol,
        exchangeRate: 1,
        lineItems: proposal.lineItems as unknown as Prisma.InputJsonValue,
        discountRate: 0,
        discountAmount: proposal.discount,
        taxRate: 0,
        taxAmount: proposal.tax,
        subtotalConverted: proposal.subtotal,
        processingFeeRate: 0,
        processingFeeConverted: 0,
        totalPayable: proposal.total,
        paymentGateway,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        brandId: 'catalyst',
        sourceChannel: 'CHECKOUT',
        checkoutSessionId: session.id,
        salesInquiryId: inquiry.id,
        proposalId: proposal.id,
      },
    });

    return { invoice, session };
  });

  let paymentUrl = '';
  if (paymentGateway === 'RAZORPAY') {
    try {
      const rpRes = await createRazorpayPaymentLink({ ...result.invoice, lineItems: proposal.lineItems } as never);
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
        notes: `Custom Proposal: ${proposal.title}`,
        lineItems: proposal.lineItems as any,
        taxAmount: proposal.tax,
        discountAmount: proposal.discount,
        processingFeeAmount: 0,
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

  return {
    invoiceId: result.invoice.id,
    checkoutSessionId: result.session.id,
    paymentUrl: paymentUrl,
  };
}

