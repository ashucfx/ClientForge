import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { processCareerEmail, sendCareerEmail } from '@/lib/career/email';
import type { EmailTrigger } from '@/lib/career/types';
import { ADMIN_EMAIL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Authenticate cron caller — Vercel injects CRON_SECRET automatically
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // 1. Fetch pending emails that are ready to run
  const now = new Date();
  
  const queuedEmails = await db.emailQueue.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextRunAt: { lte: now },
      attempts: { lt: 3 } // Max 3 attempts
    },
    take: 10, // Process 10 at a time to avoid Vercel timeouts
    orderBy: { createdAt: 'asc' }
  });

  if (queuedEmails.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const results = [];

  // 2. Process each email atomically
  for (const email of queuedEmails) {
    // ATOMIC LOCK: Try to claim this specific email. If another cron worker grabbed it, count === 0.
    const lock = await db.emailQueue.updateMany({
      where: { id: email.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING' }
    });

    if (lock.count === 0) continue; // Safely skip; another concurrent worker claimed this email.
    try {
      const payload = email.data as any;
      const resendId = await processCareerEmail({
        to: email.to,
        trigger: email.trigger as EmailTrigger,
        data: payload?.data ?? {},
        attachmentUrls: payload?.attachmentUrls ?? [],
        clientId: email.clientId ?? undefined,
        replyTo: payload?.replyTo ?? undefined,
      });

      await db.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          attempts: { increment: 1 }
        }
      });

      results.push({ id: email.id, status: 'SENT', resendId });
    } catch (err: any) {
      console.error(`Failed to send queued email ${email.id}:`, err);
      
      const newAttempts = email.attempts + 1;
      const willRetry = newAttempts < 3;
      
      await db.emailQueue.update({
        where: { id: email.id },
        data: {
          status: willRetry ? 'FAILED' : 'PERMANENTLY_FAILED',
          error: err.message ?? String(err),
          attempts: newAttempts,
          // Exponential backoff: 5 mins, then 15 mins
          nextRunAt: new Date(Date.now() + (newAttempts === 1 ? 5 : 15) * 60 * 1000)
        }
      });

      if (!willRetry) {
        // Send a direct email to admin about the failure
        await sendCareerEmail({
          to: ADMIN_EMAIL,
          trigger: 'MESSAGE_NOTIFY',
          data: {
            recipientName: 'Catalyst Admin',
            senderType: 'system',
            body: `CRITICAL: Email to ${email.to} permanently failed after 3 attempts. Error: ${err.message ?? String(err)}. Please check the Vercel logs and Resend dashboard.`,
            portalUrl: `https://catalyst.theripplenexus.com`
          }
        }).catch(e => console.error('Failed to notify admin of permanent failure:', e));
      }

      results.push({ id: email.id, status: willRetry ? 'FAILED' : 'PERMANENTLY_FAILED', error: err.message });
    }
  }

  return NextResponse.json({ ok: true, processed: queuedEmails.length, results });
}
