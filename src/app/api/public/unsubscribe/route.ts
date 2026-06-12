import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get('lead');

  if (!leadId) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400 });
  }

  try {
    const lead = await db.flywheelCampaignLead.findUnique({
      where: { id: leadId },
      include: { contact: true, campaign: true }
    });

    if (!lead || !lead.contact.email) {
      return new NextResponse('Link expired or invalid.', { status: 404 });
    }

    const email = lead.contact.email;
    const brandId = lead.campaign.brandId;

    // Use a transaction to ensure both operations complete
    await db.$transaction(async (tx: any) => {
      // 1. Add to global unsubscribe list
      await tx.unsubscribeList.upsert({
        where: {
          email_brandId: { email, brandId }
        },
        update: {}, // Do nothing if it exists
        create: {
          email,
          brandId,
          reason: 'One-click unsubscribe'
        }
      });

      // 2. Mark the lead as unsubscribed
      await tx.flywheelCampaignLead.update({
        where: { id: lead.id },
        data: { status: 'UNSUBSCRIBED' }
      });

      // 3. Record event
      await tx.flywheelEmailEvent.create({
        data: {
          campaignLeadId: lead.id,
          eventType: 'UNSUBSCRIBE'
        }
      });
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 50px; background: #f9fafb; color: #111827; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 400px; margin: 0 auto; }
          h1 { color: #10b981; font-size: 24px; margin-bottom: 10px; }
          p { color: #4b5563; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Successfully Unsubscribed</h1>
          <p><strong>${email}</strong> has been removed from this mailing list. You will no longer receive marketing emails from us.</p>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return new NextResponse('An error occurred processing your request. Please contact support.', { status: 500 });
  }
}
