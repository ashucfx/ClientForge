// src/lib/career/email.ts
// Career Booster email sender — wraps Resend with React Email rendered HTML

import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { EmailTrigger } from './types';
import { WelcomeEmail }        from '@/emails/career/WelcomeEmail';
import { FormConfirmEmail }    from '@/emails/career/FormConfirmEmail';
import { DraftReadyEmail }     from '@/emails/career/DraftReadyEmail';
import { FinalDeliveryEmail }  from '@/emails/career/FinalDeliveryEmail';
import { LinkedInSecurityEmail } from '@/emails/career/LinkedInSecurityEmail';

const resend  = new Resend(process.env.RESEND_API_KEY!);
const FROM    = `Ripple Nexus <${process.env.FROM_EMAIL ?? 'info@theripplenexus.com'}>`;
const REPLY   = 'info@theripplenexus.com';

type Attachment = { filename: string; url: string };

interface SendEmailParams {
  to: string;
  trigger: EmailTrigger;
  data: Record<string, unknown>;
  attachmentUrls?: Attachment[];
}

async function fetchAttachmentContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch attachment: ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

export async function sendCareerEmail({
  to,
  trigger,
  data,
  attachmentUrls = [],
}: SendEmailParams): Promise<string | null> {
  const { subject, html } = await buildEmail(trigger, data);

  const attachments = await Promise.all(
    attachmentUrls.map(async (a) => ({
      filename: a.filename,
      content: await fetchAttachmentContent(a.url),
    }))
  );

  const result = await resend.emails.send({
    from: FROM,
    reply_to: REPLY,
    to,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
    tags: [{ name: 'module', value: 'career-booster' }, { name: 'trigger', value: trigger }],
  });

  if (result.error) throw new Error(result.error.message);
  return result.data?.id ?? null;
}

async function buildEmail(
  trigger: EmailTrigger,
  data: Record<string, unknown>
): Promise<{ subject: string; html: string }> {
  switch (trigger) {
    case 'WELCOME': {
      const { name, packageLabel, portalUrl } = data as { name: string; packageLabel: string; portalUrl: string };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `Welcome to ClientForge Boost — Your ${pkg} package is now active`,
        html: await render(WelcomeEmail({ name, packageLabel: pkg, portalUrl })),
      };
    }
    case 'FORM_CONFIRM': {
      const { name, formLabel } = data as { name: string; formLabel: string };
      const label = formLabel ?? 'form';
      return {
        subject: `ClientForge Boost — We have received your ${label} details`,
        html: await render(FormConfirmEmail({ name, formLabel: label })),
      };
    }
    case 'DRAFT_READY': {
      const { name, packageLabel, portalUrl } = data as { name: string; packageLabel: string; portalUrl: string };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `ClientForge Boost — Your ${pkg} draft is ready for review`,
        html: await render(DraftReadyEmail({ name, packageLabel: pkg, portalUrl })),
      };
    }
    case 'FINAL_DELIVERY': {
      const { name, packageLabel, portalUrl, files } = data as {
        name: string; packageLabel: string; portalUrl: string;
        files: { label: string; url: string }[];
      };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `ClientForge Boost — Your ${pkg} deliverables are ready`,
        html: await render(FinalDeliveryEmail({ name, packageLabel: pkg, portalUrl, files: files ?? [] })),
      };
    }
    case 'LINKEDIN_SECURITY': {
      const { name } = data as { name: string };
      return {
        subject: `ClientForge Boost — Action required: Secure your LinkedIn account`,
        html: await render(LinkedInSecurityEmail({ name })),
      };
    }
    case 'REVISION': {
      const { name, portalUrl, packageLabel } = data as { name: string; portalUrl: string; packageLabel?: string };
      const pkg = packageLabel ?? 'Career';
      return {
        subject: `ClientForge Boost — Your ${pkg} revision is in progress`,
        html: await render(DraftReadyEmail({ name, packageLabel: `${pkg} (Revised Draft)`, portalUrl })),
      };
    }
    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}
