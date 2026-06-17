import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/flywheel/marketingMailer';
import { getAdminSession } from '@/lib/auth';

// Secure the cron endpoint. Can be triggered by Vercel Cron or an Admin.
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    // If not a valid cron request, check if it's a valid admin session
    if (!isCron) {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 1. Fetch leads ready for processing
    const now = new Date();
    const leadsToProcess = await db.flywheelCampaignLead.findMany({
      where: {
        status: 'ACTIVE',
        nextExecutionAt: { lte: now }
      },
      include: {
        contact: true,
        campaign: {
          include: {
            steps: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        currentStep: true
      },
      take: 50 // Batch size to avoid SMTP rate limits or timeouts
    });

    if (leadsToProcess.length === 0) {
      return NextResponse.json({ success: true, message: 'No leads ready for processing', processedCount: 0 });
    }

    let processedCount = 0;
    let failedCount = 0;

    // 2. Process each lead
    for (const lead of leadsToProcess) {
      // If no current step, they are somehow done. Mark completed.
      if (!lead.currentStep) {
        await db.flywheelCampaignLead.update({
          where: { id: lead.id },
          data: { status: 'COMPLETED' }
        });
        continue;
      }

      // Ensure they haven't unsubscribed globally or are marked Do Not Contact
      const unsubscribed = await db.unsubscribeList.findFirst({
        where: { email: lead.contact.email!, brandId: lead.campaign.brandId }
      });
      const dnc = await db.flywheelProfile.findFirst({
        where: { contactId: lead.contact.id, optInStatus: false },
        select: { id: true },
      });

      if (unsubscribed || dnc) {
        await db.flywheelCampaignLead.update({
          where: { id: lead.id },
          data: { status: 'UNSUBSCRIBED' }
        });
        continue;
      }

      try {
        if (!lead.contact.email) {
          console.error(`[FlywheelCron] Lead ${lead.id} contact has no email — skipping`);
          continue;
        }
        await sendMarketingEmail(
          lead.contact.email,
          lead.currentStep.subject,
          lead.currentStep.contentHtml,
          lead.campaign.brandId,
          lead.id
        );

        // Record the event
        await db.flywheelEmailEvent.create({
          data: {
            campaignLeadId: lead.id,
            eventType: 'SENT'
          }
        });

        // Determine the next step
        const allSteps = lead.campaign.steps;
        const currentIndex = allSteps.findIndex(s => s.id === lead.currentStepId);
        const nextStep = allSteps[currentIndex + 1];

        if (nextStep) {
          // Advance to next step
          const nextRun = new Date();
          nextRun.setHours(nextRun.getHours() + nextStep.delayHours);

          await db.flywheelCampaignLead.update({
            where: { id: lead.id },
            data: {
              currentStepId: nextStep.id,
              nextExecutionAt: nextRun
            }
          });
        } else {
          // No more steps, campaign completed for this lead
          await db.flywheelCampaignLead.update({
            where: { id: lead.id },
            data: { status: 'COMPLETED' }
          });
        }

        processedCount++;
      } catch (error) {
        console.error(`[FlywheelCron] Failed to process lead ${lead.id}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Batch processed',
      processedCount,
      failedCount,
      totalFound: leadsToProcess.length,
    });

  } catch (error) {
    console.error('[FlywheelCron] Execution Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
