// src/lib/career/email.ts
// Career Booster email sender — wraps Resend with React Email rendered HTML

import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { EmailTrigger } from './types';
import { WelcomeEmail }          from '@/emails/career/WelcomeEmail';
import { LoginLinkEmail }        from '@/emails/career/LoginLinkEmail';
import { FormConfirmEmail }      from '@/emails/career/FormConfirmEmail';
import { DraftReadyEmail }       from '@/emails/career/DraftReadyEmail';
import { LinkedInDraftEmail }    from '@/emails/career/LinkedInDraftEmail';
import { RevisedDraftEmail }     from '@/emails/career/RevisedDraftEmail';
import { FinalDeliveryEmail }    from '@/emails/career/FinalDeliveryEmail';
import { LinkedInSecurityEmail } from '@/emails/career/LinkedInSecurityEmail';
import { MessageNotifyEmail }    from '@/emails/career/MessageNotifyEmail';
import { RevisionEmail }         from '@/emails/career/RevisionEmail';
import { DeleteOtpEmail }        from '@/emails/career/DeleteOtpEmail';
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
}

async function fetchAttachmentContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch attachment: ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
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

export async function sendCareerEmail({
  to,
  trigger,
  data,
  attachmentUrls = [],
  clientId,
}: SendEmailParams): Promise<string | null> {
  const { subject, html } = await buildEmail(trigger, data);

  const attachments = await Promise.all(
    attachmentUrls.map(async (a) => ({
      filename: a.filename,
      content: await fetchAttachmentContent(a.url),
    }))
  );

  try {
    const resendId = await sendWithRetry(async () => {
      const result = await resend.emails.send({
        from: FROM,
        reply_to: REPLY,
        to,
        subject,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
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

async function buildEmail(
  trigger: EmailTrigger,
  data: Record<string, unknown>,
): Promise<{ subject: string; html: string }> {
  switch (trigger) {
    case 'WELCOME': {
      const { name, packageLabel, portalUrl } = data as { name: string; packageLabel: string; portalUrl: string };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `Welcome to Catalyst Career Boost - Your services are now active`,
        html: await render(WelcomeEmail({ name, packageLabel: pkg, portalUrl })),
      };
    }

    case 'LOGIN_LINK': {
      const { name, portalUrl } = data as { name: string; portalUrl: string };
      return {
        subject: `Catalyst — Your secure login link`,
        html: await render(LoginLinkEmail({ name, portalUrl })),
      };
    }

    case 'FORM_CONFIRM': {
      const { name, formLabel } = data as { name: string; formLabel: string };
      const label = formLabel ?? 'form';
      return {
        subject: `Catalyst - We have received your ${label}`,
        html: await render(FormConfirmEmail({ name, formLabel: label })),
      };
    }

    case 'DRAFT_READY': {
      const { name, packageLabel, portalUrl } = data as { name: string; packageLabel: string; portalUrl: string };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `Catalyst - Your ${pkg} draft is ready for review`,
        html: await render(DraftReadyEmail({ name, packageLabel: pkg, portalUrl })),
      };
    }

    case 'LINKEDIN_DRAFT': {
      const { name, portalUrl, revisionsLeft } = data as {
        name: string; portalUrl: string; revisionsLeft?: number;
      };
      return {
        subject: `Catalyst - Your LinkedIn profile optimisation draft is ready`,
        html: await render(LinkedInDraftEmail({ name, portalUrl, revisionsLeft: revisionsLeft ?? 2 })),
      };
    }

    case 'REVISED_DRAFT': {
      const { name, packageLabel, portalUrl, revisionsLeft } = data as {
        name: string; packageLabel: string; portalUrl: string; revisionsLeft?: number;
      };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `Catalyst - Your revised ${pkg} draft is ready`,
        html: await render(RevisedDraftEmail({ name, packageLabel: pkg, portalUrl, revisionsLeft: revisionsLeft ?? 1 })),
      };
    }

    case 'FINAL_DELIVERY': {
      const { name, packageLabel, portalUrl, files } = data as {
        name: string; packageLabel: string; portalUrl: string;
        files: { label: string; url: string }[];
      };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `Catalyst - Your ${pkg} deliverables are ready`,
        html: await render(FinalDeliveryEmail({ name, packageLabel: pkg, portalUrl, files: files ?? [] })),
      };
    }

    case 'LINKEDIN_SECURITY': {
      const { name } = data as { name: string };
      return {
        subject: `Catalyst - Action required: Secure your LinkedIn account`,
        html: await render(LinkedInSecurityEmail({ name })),
      };
    }

    case 'REVISION': {
      const { name, portalUrl, packageLabel, revisionStatus } = data as {
        name: string; portalUrl: string; packageLabel?: string;
        revisionStatus?: 'approved' | 'denied';
      };
      const pkg = packageLabel ?? 'Career';
      if (revisionStatus === 'denied') {
        return {
          subject: `Catalyst - Update on your revision request`,
          html: await render(RevisionEmail({ name, packageLabel: pkg, portalUrl, status: 'denied' })),
        };
      }
      return {
        subject: `Catalyst - Your ${pkg} revision is now in progress`,
        html: await render(RevisionEmail({ name, packageLabel: pkg, portalUrl, status: 'approved' })),
      };
    }

    case 'MESSAGE_NOTIFY': {
      const { recipientName, senderType, portalUrl, body: customBody } = data as {
        recipientName: string;
        senderType: 'client' | 'admin';
        portalUrl: string;
        body?: string;
      };
      const fromLabel = senderType === 'admin' ? 'Your career consultant' : 'Your client';
      const subject = (data.subject as string | undefined)
        ?? `Catalyst - ${fromLabel} has sent you a new message`;
      return {
        subject,
        html: await render(MessageNotifyEmail({ recipientName, senderType, portalUrl, body: customBody })),
      };
    }

    case 'DELETE_OTP': {
      const { clientName, clientEmail, otp, expiresMinutes } = data as {
        clientName: string; clientEmail: string; otp: string; expiresMinutes: number;
      };
      return {
        // OTP intentionally NOT in subject — visible in push notifications and email previews
        subject: `Catalyst Admin — Action required: Confirm deletion of ${clientName}`,
        html: await render(DeleteOtpEmail({ clientName, clientEmail, otp, expiresMinutes })),
      };
    }

    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}
