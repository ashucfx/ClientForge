import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { BASE_PRICING, FEE_RATES, round2 } from '@/lib/pricing';
import { getNextInvoiceNumber } from '@/lib/invoiceUtils';
import { createRazorpayPaymentLink } from '@/lib/razorpay';
import type { CareerServiceSlug } from '@/lib/career/types';
import type { ClientType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetUpgrade = body?.targetService; // 'FULL_PACKAGE' or 'PREMIUM_PLUS'
  
  if (targetUpgrade !== 'FULL_PACKAGE' && targetUpgrade !== 'PREMIUM_PLUS') {
    return NextResponse.json({ error: 'Invalid upgrade target' }, { status: 400 });
  }

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    include: {
      services: { select: { service: { select: { slug: true } } } },
      invoiceLinks: {
        include: { invoice: { select: { clientType: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const existingServices = client.services.map(s => s.service.slug as CareerServiceSlug);
  const hasResume = existingServices.includes('RESUME');
  const hasLinkedIn = existingServices.includes('LINKEDIN');
  const hasCoverLetter = existingServices.includes('COVER_LETTER');
  const hasFull = existingServices.includes('FULL_PACKAGE');
  const hasPortfolio = existingServices.includes('PORTFOLIO');

  // Verify they actually need an upgrade
  if (targetUpgrade === 'FULL_PACKAGE' && hasFull) {
    return NextResponse.json({ error: 'Already have full package' }, { status: 400 });
  }
  if (targetUpgrade === 'PREMIUM_PLUS' && hasPortfolio && hasFull) {
    return NextResponse.json({ error: 'Already have premium plus' }, { status: 400 });
  }

  // Calculate Difference based on their original tier
  const clientType = (client.invoiceLinks[0]?.invoice?.clientType as ClientType) || 'MID_CAREER';
  const base = BASE_PRICING[clientType];
  
  if (!base) return NextResponse.json({ error: 'Pricing not configured for client type' }, { status: 400 });

  let targetPrice = 0;
  let currentlyPaid = 0;

  if (targetUpgrade === 'FULL_PACKAGE') {
     // Target is sum of all three. (If Catalyst uses a bundled discount for full package, we would use that, but for now we sum base prices)
     targetPrice = base.resume + base.linkedin + base.coverLetter;
  } else if (targetUpgrade === 'PREMIUM_PLUS') {
     targetPrice = base.resume + base.linkedin + base.coverLetter + base.portfolio;
  }

  // Calculate what they conceptually own right now
  if (hasFull) {
     currentlyPaid += base.resume + base.linkedin + base.coverLetter;
  } else {
     if (hasResume) currentlyPaid += base.resume;
     if (hasLinkedIn) currentlyPaid += base.linkedin;
     if (hasCoverLetter) currentlyPaid += base.coverLetter;
  }
  if (hasPortfolio) currentlyPaid += base.portfolio;

  const differenceInr = targetPrice - currentlyPaid;
  if (differenceInr <= 0) {
    return NextResponse.json({ error: 'No price difference to upgrade' }, { status: 400 });
  }

  // Calculate final amounts including fee
  const exchangeRate = 1; 
  const subtotalConverted = round2(differenceInr);
  const processingFeeRate = FEE_RATES.INR;
  const processingFeeConverted = round2(subtotalConverted * processingFeeRate);
  const totalPayable = round2(subtotalConverted + processingFeeConverted);

  const invoiceDate = new Date();
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h window — Razorpay expire_by uses this

  let invoice;
  let createError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const invoiceNumber = await getNextInvoiceNumber();
      invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          brandId: 'catalyst',
          clientName: client.name,
          clientEmail: client.email,
          clientPhone: client.phone || '+910000000000',
          clientType,
          country: 'IN',
          currency: 'INR',
          currencySymbol: '₹',
          exchangeRate: 1,
          lineItems: [
            {
              id: 'upgrade_1',
              description: `Upgrade to ${targetUpgrade === 'FULL_PACKAGE' ? 'Complete Career Booster' : 'Premium Plus (Portfolio)'}`,
              qty: 1,
              unitPrice: differenceInr,
              lineTotal: differenceInr
            }
          ],
          discountRate: 0,
          taxRate: 0,
          discountAmount: 0,
          taxAmount: 0,
          subtotalConverted,
          processingFeeRate,
          processingFeeConverted,
          totalPayable,
          notes: `Portal automated upgrade. Target: ${targetUpgrade}`,
          invoiceDate,
          dueDate,
          installmentPlan: false,
          installmentCount: 1,
          paymentGateway: 'RAZORPAY',
        }
      });
      break; // Success
    } catch (err: any) {
      if (err.code === 'P2002') {
        createError = err;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 100 * attempt));
          continue;
        }
      }
      throw err;
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Failed to generate invoice sequence. Please try again.' }, { status: 500 });
  }

  try {
    const rzp = await createRazorpayPaymentLink(invoice as any);
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        razorpayLinkId: rzp.id,
        razorpayLinkUrl: rzp.short_url,
      }
    });

    return NextResponse.json({ 
      ok: true, 
      paymentUrl: rzp.short_url,
      difference: differenceInr,
      totalPayable
    });
  } catch (err: any) {
    console.error('Upgrade Razorpay Error:', err?.message ?? err);
    await db.invoice.delete({ where: { id: invoice.id }});
    return NextResponse.json({ error: 'Payment link creation failed' }, { status: 500 });
  }
}
