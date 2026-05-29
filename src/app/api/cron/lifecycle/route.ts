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

  return NextResponse.json({ ok: true, processed: processedCount });
}
