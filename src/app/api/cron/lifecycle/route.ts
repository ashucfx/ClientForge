import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PORTAL_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Authenticate cron caller — Vercel injects CRON_SECRET automatically
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let processedCount = 0;

  // -------------------------------------------------------------------------
  // 1. Ghost Warning (7 days in DRAFT_SENT)
  // -------------------------------------------------------------------------
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const ghostWarningClients = await db.careerClient.findMany({
    where: {
      status: 'DRAFT_SENT',
      draftSentAt: { lte: sevenDaysAgo },
    },
    select: { id: true, email: true, name: true },
  });

  const ghostWarningClientIds = ghostWarningClients.map(c => c.id);
  const existingWarningLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: ghostWarningClientIds }, trigger: 'GHOST_WARNING', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyWarned = new Set(existingWarningLogs.map(l => l.clientId));

  for (const client of ghostWarningClients) {
    if (!alreadyWarned.has(client.id)) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY', // Re-using generic template
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Action Required: Your Revision Window is Closing Soon',
          body: `Hi ${client.name.split(' ')[0]},\n\nJust checking in! We sent your draft exactly a week ago. Your revision window closes in 3 days.\n\nPlease log in to review your documents and request any final changes. If we don't hear from you, we will assume you are happy with the draft and finalize your order.`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'GHOST_WARNING', status: 'sent' },
      });
      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Ghost Closure (10 days in DRAFT_SENT)
  // -------------------------------------------------------------------------
  const tenDaysAgo = new Date(now);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const ghostClosureClients = await db.careerClient.findMany({
    where: {
      status: 'DRAFT_SENT',
      draftSentAt: { lte: tenDaysAgo },
    },
    select: { id: true, email: true, name: true },
  });

  const ghostClosureClientIds = ghostClosureClients.map(c => c.id);
  const existingClosureLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: ghostClosureClientIds }, trigger: 'GHOST_CLOSURE', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyClosed = new Set(existingClosureLogs.map(l => l.clientId));

  for (const client of ghostClosureClients) {
    // Auto-close order
    await db.careerClient.update({
      where: { id: client.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    if (!alreadyClosed.has(client.id)) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Your Order is Now Finalized',
          body: `Hi ${client.name.split(' ')[0]},\n\nSince your revision window has expired, we have finalized your order and marked it as completed. You can download your final documents from the portal.\n\nThank you for choosing our services!`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'GHOST_CLOSURE', status: 'sent' },
      });
      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Automated Reviews (7 days in COMPLETED)
  // -------------------------------------------------------------------------
  const completedSevenDaysAgo = new Date(now);
  completedSevenDaysAgo.setDate(completedSevenDaysAgo.getDate() - 7);

  const reviewClients = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: completedSevenDaysAgo },
    },
    select: { id: true, email: true, name: true },
  });

  const reviewClientIds = reviewClients.map(c => c.id);
  const existingReviewLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: reviewClientIds }, trigger: 'REVIEW_REQUEST', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyReviewed = new Set(existingReviewLogs.map(l => l.clientId));

  for (const client of reviewClients) {
    if (!alreadyReviewed.has(client.id)) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `https://www.trustpilot.com/evaluate/theripplenexus.com`,
          subject: 'How did we do?',
          body: `Hi ${client.name.split(' ')[0]},\n\nIt's been a week since we finalized your documents! We hope your job search is going great and you are landing those interviews.\n\nIf you loved our service, would you mind dropping a quick review? It really helps us out!\n\nClick the portal button below to leave a review.`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'REVIEW_REQUEST', status: 'sent' },
      });
      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 5. Revision Eligibility Nudge (25 days in COMPLETED)
  // -------------------------------------------------------------------------
  const twentyFiveDaysAgo = new Date(now);
  twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25);

  const expiringClients = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: twentyFiveDaysAgo },
      lifecycleStatus: 'ACTIVE',
    },
    select: { id: true, email: true, name: true },
  });

  const expiringClientIds = expiringClients.map(c => c.id);
  const existingExpiringLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: expiringClientIds }, trigger: 'REVISION_EXPIRING', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyNudged = new Set(existingExpiringLogs.map(l => l.clientId));

  for (const client of expiringClients) {
    if (!alreadyNudged.has(client.id)) {
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Reminder: 5 Days Left to Request Revisions',
          body: `Hi ${client.name.split(' ')[0]},\n\nJust a quick reminder that your 30-day revision window will close in 5 days. After this time, your project will be safely archived.\n\nIf you need any final tweaks to your documents, please log in to the portal and submit a revision request before the window closes.`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'REVISION_EXPIRING', status: 'sent' },
      });
      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 6. Unread Message Escalation (24-Hour SLA for Career)
  // -------------------------------------------------------------------------
  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const unreadMessages = await db.careerMessage.findMany({
    where: {
      authorType: 'client',
      readByAdmin: false,
      createdAt: { lte: twentyFourHoursAgo },
    },
    select: { clientId: true, authorName: true },
    distinct: ['clientId'],
  });

  for (const msg of unreadMessages) {
    const recentEscalation = await db.careerEmailLog.findFirst({
      where: {
        clientId: msg.clientId,
        trigger: 'UNREAD_ESCALATION',
        sentAt: { gte: twentyFourHoursAgo },
      }
    });

    if (!recentEscalation) {
      await sendCareerEmail({
        to: process.env.ADMIN_NOTIFY_EMAIL ?? 'catalyst@theripplenexus.com',
        trigger: 'MESSAGE_NOTIFY',
        clientId: msg.clientId,
        data: {
          recipientName: 'Catalyst Team',
          senderType: 'system',
          portalUrl: `${PORTAL_URL}/career/${msg.clientId}`,
          subject: `ACTION REQUIRED: Unread messages from ${msg.authorName}`,
          body: `You have messages from ${msg.authorName} that have been unread for over 24 hours.\n\nPlease log in to the admin dashboard and respond promptly to meet SLA requirements.`,
        },
      });

      await db.careerEmailLog.create({
        data: { clientId: msg.clientId, trigger: 'UNREAD_ESCALATION', status: 'sent' },
      });
      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 6b. Unread Message Escalation (24-Hour SLA for RN)
  // -------------------------------------------------------------------------
  const rnUnreadMessages = await db.rnMessage.findMany({
    where: {
      authorType: 'client',
      readByAdmin: false,
      createdAt: { lte: twentyFourHoursAgo },
    },
    select: { clientId: true, authorName: true },
    distinct: ['clientId'],
  });

  for (const msg of rnUnreadMessages) {
    const recentEscalation = await db.rnActivityLog.findFirst({
      where: {
        clientId: msg.clientId,
        action: 'UNREAD_ESCALATION',
        createdAt: { gte: twentyFourHoursAgo },
      }
    });

    if (!recentEscalation) {
      // RN uses a different email approach, usually to team@theripplenexus.com
      const { Resend } = await import('resend');
      const { getBrand } = await import('@/lib/brand/registry');
      try {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const brand = getBrand('ripple_nexus');
        
        await resend.emails.send({
          from: `${brand.name} <${brand.fromEmail}>`,
          reply_to: brand.replyTo,
          to: process.env.ADMIN_NOTIFY_EMAIL ?? 'team@theripplenexus.com',
          subject: `ACTION REQUIRED: Unread RN messages from ${msg.authorName}`,
          html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#333;line-height:1.6;max-width:600px;margin:0 auto">
            <h2>Action Required</h2>
            <p>You have messages from ${msg.authorName} that have been unread for over 24 hours.</p>
            <div style="margin:24px 0">
              <a href="${PORTAL_URL}/rn/${msg.clientId}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">
                View Messages
              </a>
            </div>
            <p style="color:#666;font-size:13px">Please respond promptly to meet SLA requirements.</p>
          </div>`,
        });

        // Log to RN Activity Log since there's no rnEmailLog table
        await db.rnActivityLog.create({
          data: {
            clientId: msg.clientId,
            action: 'UNREAD_ESCALATION',
            performedBy: 'system',
            metadata: { escalatedTo: process.env.ADMIN_NOTIFY_EMAIL ?? 'team@theripplenexus.com' }
          }
        });
        processedCount++;
      } catch (err) {
        console.error('[RN Escalation] Email failed:', err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. Automated 30-day Archival (Phase 4)
  // -------------------------------------------------------------------------
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 4a. Archive Career Clients
  const careerToArchive = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: thirtyDaysAgo },
      lifecycleStatus: 'ACTIVE',
    },
    select: { id: true, email: true },
  });

  for (const client of careerToArchive) {
    await db.careerClient.update({
      where: { id: client.id },
      data: {
        lifecycleStatus: 'ARCHIVED',
        archivedAt: new Date(),
        archiveReason: 'AUTO_30D',
        magicToken: null,
        magicTokenExpiry: null,
      },
    });
    await db.careerActivityLog.create({
      data: {
        clientId: client.id,
        action: 'auto_archived',
        performedBy: 'system',
        metadata: { reason: '30 days since completion' }
      }
    });
    processedCount++;
  }

  // 4b. Archive RN Clients
  const rnToArchive = await db.rnClient.findMany({
    where: {
      completedAt: { lte: thirtyDaysAgo },
      lifecycleStatus: 'ACTIVE',
    },
    select: { id: true, email: true },
  });

  for (const client of rnToArchive) {
    await db.rnClient.update({
      where: { id: client.id },
      data: {
        lifecycleStatus: 'ARCHIVED',
        archivedAt: new Date(),
        archiveReason: 'AUTO_30D',
        magicToken: null,
        magicTokenExpiry: null,
      },
    });
    await db.rnActivityLog.create({
      data: {
        clientId: client.id,
        action: 'auto_archived',
        performedBy: 'system',
        metadata: { reason: '30 days since completion' }
      }
    });
    processedCount++;
  }

  return NextResponse.json({ ok: true, processed: processedCount });
}
