// src/lib/career/email.ts
// Career Booster email sender — wraps Resend with React Email rendered HTML

import { Resend } from 'resend';
import { waitUntil } from '@vercel/functions';
import type { EmailTrigger } from './types';
import { prisma as db }          from '@/lib/db';
import { BRAND_EMAIL }           from '@/lib/config';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM   = `Catalyst <${process.env.FROM_EMAIL ?? BRAND_EMAIL}>`;
const REPLY  = BRAND_EMAIL;

type Attachment = { filename: string; url: string };

interface SendEmailParams {
  to: string;
  trigger: EmailTrigger;
  data: Record<string, unknown>;
  attachmentUrls?: Attachment[];
  /** Optional: clientId for DB error logging on repeated failures */
  clientId?: string;
  /** Optional: custom reply-to address */
  replyTo?: string;
}


/** Send with up to 3 attempts, exponential back-off (1s, 2s, 3s) */
async function sendWithRetry(
  fn: () => Promise<string | null>,
  maxAttempts = 3,
): Promise<string | null> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}

/** 
 * Push email to database queue instead of sending directly.
 * Processed by /api/cron/email.
 */
export async function sendCareerEmail({
  to,
  trigger,
  data,
  attachmentUrls = [],
  clientId,
  replyTo,
}: SendEmailParams): Promise<string | null> {
  // Store the raw params so the cron worker can process it
  const queueData = {
    data,
    attachmentUrls
  };

  const queued = await db.emailQueue.create({
    data: {
      to,
      trigger,
      clientId,
      data: queueData as any,
      status: 'PROCESSING',  // Prevent cron from picking up while immediate send is in-flight
    }
  });

  // Execute immediately to bypass minutely cron restrictions on Vercel Hobby
  waitUntil(
    processCareerEmail({ to, trigger, data, attachmentUrls, clientId, replyTo })
      .then(async () => {
        await db.emailQueue.update({
          where: { id: queued.id },
          data: { status: 'SENT', attempts: 1 }
        });
      })
      .catch(async (err) => {
        console.error(`Failed to send immediate email ${queued.id}:`, err);
        // Reset to PENDING so the cron job can retry later
        await db.emailQueue.update({
          where: { id: queued.id },
          data: {
            status: 'PENDING',
            error: err.message ?? String(err),
            attempts: 1,
            nextRunAt: new Date(Date.now() + 5 * 60 * 1000)
          }
        });
      })
  );

  return queued.id; // Return the queue ID instead of Resend ID
}

/** Actual worker function to send an email (called by cron) */
export async function processCareerEmail({

  to,
  trigger,
  data,
  attachmentUrls = [],
  clientId,
  replyTo,
}: SendEmailParams): Promise<string | null> {
  const { buildEmail } = await import('./email-templates');
  const { subject, html } = await buildEmail(trigger, data);

  try {
    const resendId = await sendWithRetry(async () => {
      const result = await resend.emails.send({
        from: FROM,
        reply_to: replyTo ?? REPLY,
        to,
        subject,
        html,
        tags: [
          { name: 'module',  value: 'career-booster' },
          { name: 'trigger', value: trigger },
        ],
      });
      if (result.error) throw new Error(result.error.message);
      return result.data?.id ?? null;
    });

    // Log success if clientId provided
    if (clientId) {
      await db.careerEmailLog.create({
        data: { clientId, trigger, resendId, status: 'sent' },
      }).catch(() => null); // non-blocking
    }

    return resendId;
  } catch (err) {
    // Log failure if clientId provided
    if (clientId) {
      await db.careerEmailLog.create({
        data: {
          clientId,
          trigger,
          status: 'failed',
          metadata: { error: err instanceof Error ? err.message : String(err) },
        },
      }).catch(() => null);
    }
    throw err;
  }
}

