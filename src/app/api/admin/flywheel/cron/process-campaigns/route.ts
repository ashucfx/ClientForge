import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/flywheel/marketingMailer';
import { getAdminSession } from '@/lib/auth';
import { resolveAudienceContactIds, enrollLeads } from '@/lib/flywheel/enroll';

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

    const now = new Date();

    // 0. Launch any SCHEDULED campaigns whose time has arrived — enrol their
    //    saved audience, which flips them to ACTIVE so step 1 sends below.
    const scheduledCampaigns = await db.flywheelCampaign.findMany({
      where: { status: 'SCHEDULED' },
      select: { id: true, name: true, metadata: true },
    });
    let launchedCount = 0;
    for (const c of scheduledCampaigns) {
      const meta = (c.metadata ?? {}) as { scheduledAt?: string; scheduledContactIds?: string[] };
      if (!meta.scheduledAt || new Date(meta.scheduledAt).getTime() > now.getTime()) continue;
      try {
        const ids = Array.isArray(meta.scheduledContactIds) && meta.scheduledContactIds.length > 0
          ? meta.scheduledContactIds
          : await resolveAudienceContactIds(c.metadata);
        const r = await enrollLeads(c.id, ids);
        launchedCount++;
        console.log(`[FlywheelCron] Launched scheduled campaign "${c.name}": enrolled ${r.enrolled}, already ${r.alreadyEnrolled}, dnc ${r.dncSkipped}`);
      } catch (err) {
        console.error(`[FlywheelCron] Failed to launch scheduled campaign ${c.id}:`, err);
      }
    }

    // 1. Fetch leads ready for processing
    // Pre-fetch all unsubscribed emails and DNC contacts for this brand to avoid N+1 per lead
    const [allUnsubscribed, allDnc] = await Promise.all([
      db.unsubscribeList.findMany({ select: { email: true, brandId: true } }),
      db.flywheelProfile.findMany({ where: { optInStatus: false }, select: { contactId: true } }),
    ]);
    const unsubscribedSet = new Set(allUnsubscribed.map(u => `${u.email}::${u.brandId}`));
    const dncContactIds = new Set(allDnc.map(p => p.contactId));

    const leadsToProcess = await db.flywheelCampaignLead.findMany({
      where: {
        status: 'ACTIVE',
        // Fresh timestamp (not `now`) so leads enrolled by the scheduled-launch
        // step above are picked up in this same run, not the next one.
        nextExecutionAt: { lte: new Date() },
        campaign: { status: 'ACTIVE' }, // Only process leads for active (non-paused) campaigns
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
      return NextResponse.json({ success: true, message: 'No leads ready for processing', processedCount: 0, launchedCount });
    }

    let processedCount = 0;
    let failedCount = 0;

    // 2. Process each lead
    for (const lead of leadsToProcess) {
      // Guard: campaign may have been paused between the initial batch query and now
      if (lead.campaign.status !== 'ACTIVE') {
        continue;
      }

      // If no current step, they are somehow done. Mark completed.
      if (!lead.currentStep) {
        await db.flywheelCampaignLead.update({
          where: { id: lead.id },
          data: { status: 'COMPLETED' }
        });
        continue;
      }

      // Ensure they haven't unsubscribed globally or are marked Do Not Contact
      const isUnsubscribed = unsubscribedSet.has(`${lead.contact.email}::${lead.campaign.brandId}`);
      const isDnc = dncContactIds.has(lead.contact.id);

      if (isUnsubscribed || isDnc) {
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
          lead.id,
          lead.contact.name,
          lead.currentStepId, // step-aware tracking (fixes drip open/click attribution)
        );

        // Brief pause between sends to stay within SMTP provider rate limits
        await new Promise(r => setTimeout(r, 250));

        // Record the event (with the step so per-email stats are accurate)
        await db.flywheelEmailEvent.create({
          data: {
            campaignLeadId: lead.id,
            eventType: 'SENT',
            metadata: { step: lead.currentStepId } as object,
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
      launchedCount,
    });

  } catch (error) {
    console.error('[FlywheelCron] Execution Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
