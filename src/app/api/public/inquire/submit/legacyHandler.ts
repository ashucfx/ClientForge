import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { calculatePricing, PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { z } from 'zod';
import { createWithGeneratedDisplayId, nextContactDisplayId } from '@/lib/displayIds';

const InquireSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is too short').max(20),
  countryCode: z.string().length(2, 'Invalid country code'),
  countryName: z.string().min(2),
  experienceLevel: z.nativeEnum(ClientType),
  services: z.array(z.string()).min(1, 'Select at least one service'),
  packageSlug: z.enum(['CAREER_BOOSTER', 'PREMIUM_PLUS', 'CUSTOM']),
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional(),
});

/** Legacy inquire handler — preserved for backward compatibility when FEATURE_NEW_INQUIRE_FLOW is off */
export async function POST(req: Request, body?: unknown) {
  try {
    const rawBody = body ?? (await req.json());
    const parseResult = InquireSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.format() },
        { status: 400 }
      );
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

    const applicationRequest = {
      experienceLevel,
      services,
      packageSlug,
      countryCode,
      preferredGateway: paymentGateway,
      pricingDetails: {
        currency: pricing.currency,
        currencySymbol: pricing.currencySymbol,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        discountRate: pricing.discountRate,
        taxAmount: pricing.taxAmount,
        taxRate: pricing.taxRate,
        finalPayable: pricing.finalPayable,
        internalGatewayFee: pricing.internalGatewayFee,
      },
      submittedAt: new Date(),
    };

    const contactId = await db.$transaction(async (tx) => {
      let contact = await tx.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
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
                name,
                email,
                phone,
                country: countryCode,
                contactSource: 'WEBSITE_INQUIRY',
                flywheelProfile: {
                  create: {
                    lifecycleStage: 'LEAD',
                    leadStatus: 'NEW',
                    metadata: { applicationRequest },
                    createdAt: new Date(),
                  },
                },
              },
              include: { flywheelProfile: true },
            })
        );
      } else {
        contact = await tx.contact.update({
          where: { id: contact.id },
          data: { name, phone, country: countryCode },
          include: { flywheelProfile: true },
        });

        if (contact.flywheelProfile) {
          const existingMeta =
            (contact.flywheelProfile.metadata as Record<string, unknown>) || {};
          await tx.flywheelProfile.update({
            where: { id: contact.flywheelProfile.id },
            data: {
              metadata: { ...existingMeta, applicationRequest },
            },
          });
        } else {
          await tx.flywheelProfile.create({
            data: {
              contactId: contact.id,
              lifecycleStage: 'LEAD',
              leadStatus: 'NEW',
              metadata: { applicationRequest },
            },
          });
        }
      }
      return contact.id;
    });

    return NextResponse.json({
      success: true,
      message: 'Application received and under review',
      contactId,
    });
  } catch (error) {
    console.error('Legacy Inquire Submit Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
