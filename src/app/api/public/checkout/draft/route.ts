import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { calculatePricing, PricingParams, PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
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

    // 1. Calculate Pricing
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
      where: { email: { equals: email, mode: 'insensitive' } }
    });

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
          contactSource: 'WEBSITE',
          flywheelProfile: {
            create: {
              lifecycleStage: 'LEAD',
              leadStatus: 'NEW',
              createdAt: new Date(),
            }
          }
        }
      });
    }

    // 4. Generate Invoice (PENDING)
    const count = await db.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    // Map line items
    const lineItems = pricing.services.map(s => ({
      id: crypto.randomUUID(),
      description: `${s.slug} (${experienceLevel})`,
      qty: 1,
      unitPrice: s.price,
      lineTotal: s.price
    }));

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        clientType: experienceLevel,
        country: countryCode,
        currency: pricing.currency,
        currencySymbol: pricing.currencySymbol,
        exchangeRate: 1, // Base rate
        lineItems: JSON.stringify(lineItems),
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
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        brandId: 'catalyst',
      }
    });

    // 5. Create Payment Link
    let paymentUrl = '';
    
    // We must pass a structure that matches `InvoiceData` for createRazorpayPaymentLink
    const fakeInvoiceData: any = { ...invoice };

    if (paymentGateway === 'RAZORPAY') {
      const rpRes = await createRazorpayPaymentLink(fakeInvoiceData);
      paymentUrl = rpRes.short_url;

      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          razorpayLinkId: rpRes.id,
          razorpayLinkUrl: paymentUrl,
        }
      });
    } else {
      // PayPal Logic placeholder.
      paymentUrl = `https://paypal.me/placeholder/${pricing.finalPayable}`;
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          paypalPaymentUrl: paymentUrl,
        }
      });
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
    console.error('Draft Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
