import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { processCareerEmail } from '@/lib/career/email';
import { PORTAL_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // ── 1. Stale Reminder (NOT_STARTED for 3+ days) ──────────────────────────
  const staleClients = await db.careerClient.findMany({
    where: { status: 'NOT_STARTED', createdAt: { lte: threeDaysAgo } },
    select: { id: true, email: true, name: true },
  });

  let processedCount = 0;

  const staleClientIds = staleClients.map(c => c.id);
  const existingStaleLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: staleClientIds }, trigger: 'STALE_REMINDER', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyReminded = new Set(existingStaleLogs.map(l => l.clientId));

  for (const client of staleClients) {
    if (alreadyReminded.has(client.id)) continue;
    try {
      const resendId = await processCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: "Action Required: Let's get started on your Career Package",
          body: `Hi ${client.name.split(' ')[0]},\n\nWe noticed that you haven't submitted your onboarding forms yet. Please log in to your dashboard to complete them so our team can begin working on your package.\n\nIf you have any questions, feel free to reply to this email or send us a message in the portal!`,
        },
      });
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'STALE_REMINDER', resendId: resendId ?? null, status: 'sent' },
      });
      processedCount++;
    } catch (err) {
      console.error('[STALE_REMINDER] Failed for client', client.id, err);
    }
  }

  // ── 2. Draft Reminder (DRAFT_SENT for 48h+ without feedback) ──────────────
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const staleDrafts = await db.careerClient.findMany({
    where: { status: 'DRAFT_SENT', updatedAt: { lte: twoDaysAgo } },
    select: { id: true, email: true, name: true, packageType: true },
  });

  const staleDraftIds = staleDrafts.map(c => c.id);
  const existingDraftLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: staleDraftIds }, trigger: 'DRAFT_REMINDER', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyDraftReminded = new Set(existingDraftLogs.map(l => l.clientId));

  for (const client of staleDrafts) {
    if (alreadyDraftReminded.has(client.id)) continue;
    try {
      const resendId = await processCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Review Required: Your Draft is Waiting',
          body: `Hi ${client.name.split(' ')[0]},\n\nWe sent you a draft of your career materials a couple of days ago, but we haven't received your feedback yet.\n\nPlease log in to your dashboard to review it and request any revisions or approve the draft. Our team is standing by to polish your final deliverables!\n\nIf you have any questions, just reply to this email.`,
        },
      });
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'DRAFT_REMINDER', resendId: resendId ?? null, status: 'sent' },
      });
      processedCount++;
    } catch (err) {
      console.error('[DRAFT_REMINDER] Failed for client', client.id, err);
    }
  }

  // ── 3. Keep-Warm (UNDER_PROCESS, delivery < 3 days away) ─────────────────
  const warmClients = await db.careerClient.findMany({
    where: { status: 'UNDER_PROCESS', expectedDeliveryAt: { not: null } },
    select: { id: true, email: true, name: true, expectedDeliveryAt: true },
  });

  const now = new Date();
  const warmClientIds = warmClients.map(c => c.id);
  const existingWarmLogs = await db.careerEmailLog.findMany({
    where: { clientId: { in: warmClientIds }, trigger: 'KEEP_WARM', status: 'sent' },
    select: { clientId: true },
  });
  const alreadyWarmed = new Set(existingWarmLogs.map(l => l.clientId));

  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const quotes = [
    '“Choose a job you love, and you will never have to work a day in your life.” — Confucius',
    '“Opportunities don’t happen, you create them.” — Chris Grosser',
    '“The only way to do great work is to love what you do.” — Steve Jobs',
  ];

  for (const client of warmClients) {
    if (!client.expectedDeliveryAt) continue;
    if (client.expectedDeliveryAt > threeDaysFromNow) continue;
    if (alreadyWarmed.has(client.id)) continue;

    try {
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      const resendId = await processCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY',
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Quick Update on Your Career Package!',
          body: `Hi ${client.name.split(' ')[0]},\n\nJust dropping a quick note to say our experts are hard at work crafting your documents! We are making sure every detail is tailored to your career goals.\n\nWhile you wait, here is some inspiration for your journey:\n\n${randomQuote}\n\nWe will notify you the moment your draft is ready. Hang tight!`,
        },
      });
      await db.careerEmailLog.create({
        data: { clientId: client.id, trigger: 'KEEP_WARM', resendId: resendId ?? null, status: 'sent' },
      });
      processedCount++;
    } catch (err) {
      console.error('[KEEP_WARM] Failed for client', client.id, err);
    }
  }

  return NextResponse.json({ ok: true, processed: processedCount });
}
