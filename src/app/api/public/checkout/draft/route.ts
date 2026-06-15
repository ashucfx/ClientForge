import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { calculatePricing, PricingParams, PackageSlug, ServiceSlug } from '@/lib/pricing-v2';
import { ClientType } from '@prisma/client';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { normalizePhoneE164 } from '@/lib/phone';
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
  preferredGateway: z.enum(['RAZORPAY', 'PAYPAL']).optional()
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = CheckoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
    }

    const { 
      name, email, phone, countryCode, countryName, experienceLevel, 
      services, packageSlug, preferredGateway 
    } = parseResult.data;

    // 1. Calculate Pricing
    const pricing = await calculatePricing({
      experienceLevel,
      services: services as ServiceSlug[],
      packageSlug,
      countryCode,
      countryName,
      preferredGateway
    });

    const isIndia = countryCode.toUpperCase() === 'IN';
    const paymentGateway = isIndia ? 'RAZORPAY' : (preferredGateway || 'PAYPAL');

    // 2. Wrap DB operations in a Transaction
    const { invoice, paymentUrl } = await db.$transaction(async (tx) => {
      let contact = await tx.contact.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
      });

      if (!contact) {
        let nextId = 1000;
        const allContacts = await tx.contact.findMany({ select: { displayId: true } });
        for (const c of allContacts) {
          if (c.displayId) {
            const num = parseInt(c.displayId.split('-')[1]);
            if (!isNaN(num) && num > nextId) {
              nextId = num;
            }
          }
        }
        nextId++;

        contact = await tx.contact.create({
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

      const count = await tx.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

      const formatTitleCase = (str: string) => {
        if (!str) return '';
        return str.replace(/_/g, ' ').split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      const lineItems = pricing.services.map(s => ({
        id: crypto.randomUUID(),
        description: `${formatTitleCase(s.slug)} (${formatTitleCase(experienceLevel)})`,
        qty: 1,
        unitPrice: s.price,
        lineTotal: s.price
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
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          brandId: 'catalyst',
        }
      });

      let finalPaymentUrl = '';
      const fakeInvoiceData: any = { ...newInvoice };

      if (paymentGateway === 'RAZORPAY') {
        const rpRes = await createRazorpayPaymentLink(fakeInvoiceData);
        finalPaymentUrl = rpRes.short_url;
        await tx.invoice.update({
          where: { id: newInvoice.id },
          data: {
            razorpayLinkId: rpRes.id,
            razorpayLinkUrl: finalPaymentUrl,
          }
        });
      } else {
        finalPaymentUrl = `https://paypal.me/placeholder/${pricing.finalPayable}`;
        await tx.invoice.update({
          where: { id: newInvoice.id },
          data: {
            paypalPaymentUrl: finalPaymentUrl,
          }
        });
      }

      if (email) {
        await tx.emailQueue.create({
          data: {
            to: email,
            trigger: 'INVOICE_GENERATED',
            data: {
              invoiceNumber,
              paymentUrl: finalPaymentUrl,
              amount: pricing.finalPayable,
              currency: pricing.currency
            }
          }
        });
      }

      return { invoice: newInvoice, paymentUrl: finalPaymentUrl };
    });



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
