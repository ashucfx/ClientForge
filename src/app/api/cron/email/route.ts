import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { processCareerEmail } from '@/lib/career/email';
import type { EmailTrigger } from '@/lib/career/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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

  // 2. Mark them as PROCESSING so concurrent cron jobs don't pick them up
  const ids = queuedEmails.map(e => e.id);
  await db.emailQueue.updateMany({
    where: { id: { in: ids } },
    data: { status: 'PROCESSING' }
  });

  const results = [];

  // 3. Process each email
  for (const email of queuedEmails) {
    try {
      const payload = email.data as any;
      const resendId = await processCareerEmail({
        to: email.to,
        trigger: email.trigger as EmailTrigger,
        data: payload?.data ?? {},
        attachmentUrls: payload?.attachmentUrls ?? [],
        clientId: email.clientId ?? undefined,
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

      results.push({ id: email.id, status: willRetry ? 'FAILED' : 'PERMANENTLY_FAILED', error: err.message });
    }
  }

  return NextResponse.json({ ok: true, processed: queuedEmails.length, results });
}
