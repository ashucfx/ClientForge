import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import { ClientType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const contact = await db.contact.findUnique({
      where: { id: params.id },
      include: { flywheelProfile: true }
    });

    if (!contact || !contact.flywheelProfile) {
      return NextResponse.json({ success: false, error: 'Contact or Profile not found' }, { status: 404 });
    }

    const metadata = contact.flywheelProfile.metadata as Record<string, any>;
    const request = metadata?.applicationRequest;

    if (!request) {
      return NextResponse.json({ success: false, error: 'No application request found for this lead.' }, { status: 400 });
    }

    const {
      experienceLevel,
      services,
      packageSlug,
      countryCode,
      preferredGateway,
      pricingDetails
    } = request;

    // Generate Invoice (PENDING)
    const count = await db.invoice.count();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

    // Helper to convert SNAKE_CASE to Title Case
    const formatTitleCase = (str: string) => {
      if (!str) return '';
      return str.replace(/_/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    // Map line items from the saved request
    // Wait, the saved request has services array (e.g. ['RESUME', 'LINKEDIN']) and subtotal.
    // To rebuild the exact line items with unit prices, we'd either need to store them or recalculate.
    // Since we didn't store unit prices in the inquiry request, we can just create a single line item for the package.
    const lineItems = [{
      id: crypto.randomUUID(),
      description: `Executive Package: ${formatTitleCase(packageSlug)} (${formatTitleCase(experienceLevel)})`,
      qty: 1,
      unitPrice: pricingDetails.subtotal,
      lineTotal: pricingDetails.subtotal
    }];

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        clientName: contact.name,
        clientEmail: contact.email || '',
        clientPhone: contact.phone || '',
        clientType: experienceLevel as ClientType,
        country: countryCode || 'US',
        currency: pricingDetails.currency,
        currencySymbol: pricingDetails.currencySymbol,
        exchangeRate: 1, 
        lineItems: JSON.stringify(lineItems),
        discountRate: pricingDetails.discountRate,
        discountAmount: pricingDetails.discountAmount,
        taxRate: pricingDetails.taxRate,
        taxAmount: pricingDetails.taxAmount,
        subtotalConverted: pricingDetails.subtotal,
        processingFeeRate: 0, 
        processingFeeConverted: pricingDetails.internalGatewayFee, 
        totalPayable: pricingDetails.finalPayable,
        paymentGateway: preferredGateway,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        brandId: 'catalyst',
      }
    });

    // Create Payment Link
    let paymentUrl = '';
    const fakeInvoiceData: any = { ...invoice };

    if (preferredGateway === 'RAZORPAY') {
      try {
        const rpRes = await createRazorpayPaymentLink(fakeInvoiceData);
        paymentUrl = rpRes.short_url;

        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            razorpayLinkId: rpRes.id,
            razorpayLinkUrl: paymentUrl,
          }
        });
      } catch (rpError) {
        console.error('Razorpay Gateway Error:', rpError);
        paymentUrl = '';
      }
    } else {
      // PayPal Logic placeholder.
      paymentUrl = `https://paypal.me/placeholder/${pricingDetails.finalPayable}`;
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          paypalPaymentUrl: paymentUrl,
        }
      });
    }

    // Update Flywheel Profile Status
    await db.flywheelProfile.update({
      where: { id: contact.flywheelProfile.id },
      data: {
        leadStatus: 'QUALIFIED',
        lifecycleStage: 'OPPORTUNITY'
      }
    });

    // Enqueue an email with the payment link — use sendInvoiceEmail (EmailQueue INVOICE_GENERATED is broken)
    if (contact.email && paymentUrl) {
      try {
        const { sendInvoiceEmail } = await import('@/lib/email');
        const fullInvoice = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
        await sendInvoiceEmail(fullInvoice as unknown as Parameters<typeof sendInvoiceEmail>[0]);
      } catch (e) {
        console.error('Qualify invoice email failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      paymentUrl
    });

  } catch (error) {
    console.error('Qualify Lead Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
