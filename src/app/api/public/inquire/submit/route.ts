import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { calculatePricing, PricingParams, PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { normalizePhoneE164 } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name, 
      email, 
      phone, 
      countryCode, 
      countryName,
      experienceLevel, 
      services, 
      packageSlug,
      preferredGateway
    } = body as {
      name: string;
      email: string;
      phone: string;
      countryCode: string;
      countryName: string;
      experienceLevel: ClientType;
      services: ServiceSlug[];
      packageSlug: PackageSlug;
      preferredGateway?: 'RAZORPAY' | 'PAYPAL';
    };

    if (!name || !email || !phone || !countryCode || !experienceLevel || !services || services.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Calculate Pricing (Stored for admin review, NOT billed immediately)
    const pricing = await calculatePricing({
      experienceLevel,
      services,
      packageSlug,
      countryCode,
      countryName,
      preferredGateway
    });

    const isIndia = countryCode.toUpperCase() === 'IN';
    const paymentGateway = isIndia ? 'RAZORPAY' : (preferredGateway || 'PAYPAL');

    // 2. Upsert Contact (Pre-payment Lead)
    let contact = await db.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { flywheelProfile: true }
    });

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
        internalGatewayFee: pricing.internalGatewayFee
      },
      submittedAt: new Date()
    };

    if (!contact) {
      // Find highest displayId
      let nextId = 1000;
      const allContacts = await db.contact.findMany({ select: { displayId: true } });
      for (const c of allContacts) {
        if (c.displayId) {
          const num = parseInt(c.displayId.split('-')[1]);
          if (!isNaN(num) && num > nextId) {
            nextId = num;
          }
        }
      }
      nextId++;

      contact = await db.contact.create({
        data: {
          displayId: `LD-${nextId}`,
          name,
          email,
          phone,
          country: countryCode,
          contactSource: 'WEBSITE_INQUIRY',
          flywheelProfile: {
            create: {
              lifecycleStage: 'LEAD',
              leadStatus: 'NEW',
              metadata: {
                applicationRequest
              },
              createdAt: new Date(),
            }
          }
        },
        include: { flywheelProfile: true }
      });
    } else {
      // Update existing contact
      contact = await db.contact.update({
        where: { id: contact.id },
        data: {
          name,
          phone,
          country: countryCode,
        },
        include: { flywheelProfile: true }
      });

      // Update or Create Flywheel Profile
      if (contact.flywheelProfile) {
        // Merge metadata
        const existingMeta = (contact.flywheelProfile.metadata as Record<string, any>) || {};
        await db.flywheelProfile.update({
          where: { id: contact.flywheelProfile.id },
          data: {
            metadata: {
              ...existingMeta,
              applicationRequest
            }
          }
        });
      } else {
        await db.flywheelProfile.create({
          data: {
            contactId: contact.id,
            lifecycleStage: 'LEAD',
            leadStatus: 'NEW',
            metadata: {
              applicationRequest
            }
          }
        });
      }
    }

    // Return success without an invoice ID or payment URL
    return NextResponse.json({
      success: true,
      message: 'Application received and under review',
      contactId: contact.id
    });

  } catch (error) {
    console.error('Inquire Submit Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
