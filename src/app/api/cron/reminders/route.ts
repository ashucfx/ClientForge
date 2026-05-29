import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';
import { PORTAL_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find clients in NOT_STARTED status created more than 3 days ago
  const staleClients = await db.careerClient.findMany({
    where: {
      status: 'NOT_STARTED',
      createdAt: { lte: threeDaysAgo },
    },
    select: { id: true, email: true, name: true },
  });

  let processedCount = 0;

  for (const client of staleClients) {
    // Check if we already sent a reminder
    const existingLog = await db.careerEmailLog.findFirst({
      where: {
        clientId: client.id,
        trigger: 'STALE_REMINDER',
        status: 'sent',
      },
    });

    if (!existingLog) {
      // Send the reminder
      await sendCareerEmail({
        to: client.email,
        trigger: 'MESSAGE_NOTIFY', // Re-using a generic notification template
        clientId: client.id,
        data: {
          recipientName: client.name,
          senderType: 'admin',
          portalUrl: `${PORTAL_URL}/portal/dashboard`,
          subject: 'Action Required: Let\'s get started on your Career Package',
          body: `Hi ${client.name.split(' ')[0]},\n\nWe noticed that you haven't submitted your onboarding forms yet. Please log in to your dashboard to complete them so our team can begin working on your package.\n\nIf you have any questions, feel free to reply to this email or send us a message in the portal!`,
        },
      });

      // Log it so we don't send it again
      await db.careerEmailLog.create({
        data: {
          clientId: client.id,
          trigger: 'STALE_REMINDER',
          status: 'sent',
        },
      });

      processedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Keep-Warm Emails (Entertainment / Updates)
  // Send an email if client is UNDER_PROCESS and we haven't sent this yet,
  // and it has been at least 2 days since their expectedDeliveryAt was set (which is 5 days out).
  // -------------------------------------------------------------------------
  const warmClients = await db.careerClient.findMany({
    where: {
      status: 'UNDER_PROCESS',
      expectedDeliveryAt: { not: null },
    },
    select: { id: true, email: true, name: true, expectedDeliveryAt: true },
  });

  const now = new Date();
  
  for (const client of warmClients) {
    if (!client.expectedDeliveryAt) continue;

    // Calculate when they started (roughly 5 days before expected delivery, or just check if 2 days have passed)
    // Actually, simpler: if expectedDeliveryAt is less than 3 days away, it means they've been in process for 2 days!
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    if (client.expectedDeliveryAt <= threeDaysFromNow) {
      // Check if already sent
      const existingWarmLog = await db.careerEmailLog.findFirst({
        where: {
          clientId: client.id,
          trigger: 'KEEP_WARM',
          status: 'sent',
        },
      });

      if (!existingWarmLog) {
        // Send Keep Warm email
        const quotes = [
          "“Choose a job you love, and you will never have to work a day in your life.” — Confucius",
          "“Opportunities don't happen, you create them.” — Chris Grosser",
          "“The only way to do great work is to love what you do.” — Steve Jobs"
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        await sendCareerEmail({
          to: client.email,
          trigger: 'MESSAGE_NOTIFY', // Re-using generic template
          clientId: client.id,
          data: {
            recipientName: client.name,
            senderType: 'admin',
            portalUrl: `${PORTAL_URL}/portal/dashboard`,
            subject: 'Quick Update on Your Career Package!',
            body: `Hi ${client.name.split(' ')[0]},\n\nJust dropping a quick note to say our experts are hard at work crafting your documents! We are making sure every detail is tailored to your career goals.\n\nWhile you wait, here is some inspiration for your journey:\n\n${randomQuote}\n\nWe will notify you the moment your draft is ready. Hang tight!`,
          },
        });

        await db.careerEmailLog.create({
          data: {
            clientId: client.id,
            trigger: 'KEEP_WARM',
            status: 'sent',
          },
        });

        processedCount++;
      }
    }
  }

  return NextResponse.json({ ok: true, processed: processedCount });
}
