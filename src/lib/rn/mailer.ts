// src/lib/rn/mailer.ts
// Production email system for Ripple Nexus — SMTP only (nodemailer), with
// every send (success or failure) logged to RnEmailLog.
//
// Env (Ripple Nexus SMTP):
//   RN_SMTP_HOST      e.g. smtp.hostinger.com
//   RN_SMTP_PORT      587 (STARTTLS) or 465 (implicit TLS)
//   RN_SMTP_USER      mailbox user
//   RN_SMTP_PASS      mailbox password
//   RN_SMTP_SECURE    'true' for port 465 (default: true when port == 465)
//   RN_SMTP_FROM      e.g. 'Ripple Nexus <team@theripplenexus.com>' (falls back to RN_SMTP_USER)

import nodemailer from 'nodemailer';
import { prisma as db } from '@/lib/db';

const BRAND = {
  name: 'Ripple Nexus',
  violet: '#7C5CFF',
  obsidian: '#0A0B14',
  gradient: 'linear-gradient(135deg, #7C5CFF 0%, #B794FF 55%, #22D3EE 100%)',
};

export function isRnSmtpConfigured(): boolean {
  return !!((process.env.RN_SMTP_HOST && process.env.RN_SMTP_USER && process.env.RN_SMTP_PASS) || 
            (process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.FROM_EMAIL)));
}

function getTransport() {
  const host = process.env.RN_SMTP_HOST || process.env.SMTP_HOST;
  const portStr = process.env.RN_SMTP_PORT || process.env.SMTP_PORT || '587';
  const port = Number(portStr);
  const secure = process.env.RN_SMTP_SECURE
    ? process.env.RN_SMTP_SECURE === 'true'
    : port === 465;
  const user = process.env.RN_SMTP_USER || process.env.SMTP_USER || process.env.FROM_EMAIL;
  const pass = process.env.RN_SMTP_PASS || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function fromAddress(): string {
  const user = process.env.RN_SMTP_USER || process.env.SMTP_USER || process.env.FROM_EMAIL;
  return process.env.RN_SMTP_FROM ?? `${BRAND.name} <${user}>`;
}

/** Brand-book email shell: light body (email-client-safe) with violet accents. */
export function rnEmailShell(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  const logoUrl = `${APP_URL()}/logos/rn/email-logo-dark.png`;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F4F5FA;font-family:Inter,Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:${BRAND.obsidian};border-radius:16px 16px 0 0;padding:24px 28px">
      <img src="${logoUrl}" alt="Ripple Nexus" height="34" style="display:block;height:34px;width:auto;border:0" />
    </div>
    <div style="background:#ffffff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;padding:32px 28px;color:#1F2430;line-height:1.65;font-size:14px">
      <h2 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.3px;color:#0A0B14">${title}</h2>
      ${bodyHtml}
      ${ctaLabel && ctaUrl ? `
      <div style="margin:28px 0 8px">
        <a href="${ctaUrl}" style="background:${BRAND.violet};color:#ffffff;padding:12px 26px;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">${ctaLabel}</a>
      </div>` : ''}
    </div>
    <div style="padding:18px 8px;color:#6B7394;font-size:11px;text-align:center">
      ${BRAND.name} · The Autonomous Enterprise Stack<br/>
      This email relates to your active project with ${BRAND.name}.
    </div>
  </div>
</body></html>`;
}

export interface RnSendArgs {
  clientId: string;
  to: string;
  subject: string;
  html: string;
  trigger: string;          // e.g. 'welcome', 'stage_advanced', 'milestone_payment_request', 'manual'
  sentBy?: string;          // 'system' for automatic flows, admin id for manual sends
  metadata?: Record<string, unknown>;
}

/**
 * Sends an email over the Ripple Nexus SMTP transport and logs the outcome.
 * Never throws — automatic flows must not break the action that triggered them.
 * Returns { ok, error } so manual sends can surface failures in the UI.
 */
export async function sendRnEmail(args: RnSendArgs): Promise<{ ok: boolean; error?: string }> {
  const { clientId, to, subject, html, trigger, sentBy = 'system', metadata } = args;

  // SMTP is the Ripple Nexus transport of record. Until its credentials are
  // configured, fall back to Resend so client-facing emails (OTP, portal
  // invites) never silently break. Every send is logged either way.
  if (!isRnSmtpConfigured()) {
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const { getBrand } = await import('@/lib/brand/registry');
        const brand = getBrand('ripple_nexus');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send({
          from: `${brand.name} <${brand.fromEmail}>`,
          reply_to: brand.replyTo,
          to,
          subject,
          html,
        });
        await db.rnEmailLog.create({
          data: {
            clientId, trigger, status: 'sent', to, subject,
            provider: 'resend', resendId: (result as any)?.data?.id ?? null, sentBy,
            metadata: metadata as any,
          },
        }).catch(() => {});
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err.message.slice(0, 500) : 'Send failed';
        await db.rnEmailLog.create({
          data: { clientId, trigger, status: 'failed', to, subject, provider: 'resend', error, sentBy, metadata: metadata as any },
        }).catch(() => {});
        return { ok: false, error };
      }
    }
    const error = 'SMTP not configured (set RN_SMTP_HOST / RN_SMTP_USER / RN_SMTP_PASS)';
    await db.rnEmailLog.create({
      data: { clientId, trigger, status: 'failed', to, subject, provider: 'smtp', error, sentBy, metadata: metadata as any },
    }).catch(() => {});
    return { ok: false, error };
  }

  try {
    const info = await getTransport().sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
    });
    await db.rnEmailLog.create({
      data: {
        clientId, trigger, status: 'sent', to, subject,
        provider: 'smtp', messageId: info.messageId ?? null, sentBy,
        metadata: metadata as any,
      },
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message.slice(0, 500) : 'Send failed';
    await db.rnEmailLog.create({
      data: { clientId, trigger, status: 'failed', to, subject, provider: 'smtp', error, sentBy, metadata: metadata as any },
    }).catch(() => {});
    console.error(`[rn-mailer] ${trigger} → ${to} failed:`, error);
    return { ok: false, error };
  }
}

/* ── Automatic-flow templates ─────────────────────────────────────── */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://clientforge.theripplenexus.com';

export function tplWelcome(name: string, portalUrl: string) {
  return {
    subject: `Welcome to ${BRAND.name} — your client portal is live`,
    html: rnEmailShell(
      `Welcome, ${name}!`,
      `<p>Thank you for partnering with ${BRAND.name}. Your dedicated project workspace has been created.</p>
       <p>Use your secure portal to track milestones, review deliverables, and message the team directly.</p>`,
      'Open Client Portal', portalUrl,
    ),
  };
}

export function tplStageAdvanced(name: string, serviceName: string, newStage: string, portalUrl: string) {
  return {
    subject: `${serviceName}: project moved to ${newStage.replace(/_/g, ' ')}`,
    html: rnEmailShell(
      'Your project just moved forward',
      `<p>Hi ${name},</p>
       <p>Your <strong>${serviceName}</strong> project has entered the <strong>${newStage.replace(/_/g, ' ')}</strong> phase.</p>
       <p>Open the portal to see updated progress and what happens next.</p>`,
      'View Progress', portalUrl,
    ),
  };
}

export function tplDeliverableUploaded(name: string, label: string, portalUrl: string) {
  return {
    subject: `New deliverable ready for review: ${label}`,
    html: rnEmailShell(
      'A deliverable is ready for your review',
      `<p>Hi ${name},</p>
       <p>We've uploaded <strong>${label}</strong> to your project workspace.</p>
       <p>Please review it and either approve it or request changes — your feedback keeps the project on schedule.</p>`,
      'Review Deliverable', portalUrl,
    ),
  };
}

export function tplMilestonePaymentRequest(name: string, milestoneTitle: string, amountLabel: string, portalUrl: string, invoiceUrl?: string) {
  return {
    subject: `Payment request: ${milestoneTitle} (${amountLabel})`,
    html: rnEmailShell(
      'Milestone payment requested',
      `<p>Hi ${name},</p>
       <p>The milestone <strong>${milestoneTitle}</strong> is ready for its payment of <strong>${amountLabel}</strong>.</p>
       ${invoiceUrl ? `<p>You can pay securely through the invoice link below.</p>` : `<p>Our team will share the payment link shortly, or you can reply to this email.</p>`}`,
      invoiceUrl ? 'View Invoice & Pay' : 'Open Client Portal',
      invoiceUrl ?? portalUrl,
    ),
  };
}

export function tplMilestoneCompleted(name: string, milestoneTitle: string, portalUrl: string) {
  return {
    subject: `Milestone completed: ${milestoneTitle}`,
    html: rnEmailShell(
      'Milestone completed ✓',
      `<p>Hi ${name},</p>
       <p>We've completed the milestone <strong>${milestoneTitle}</strong> on your project.</p>
       <p>Open the portal to review the work and track what's next.</p>`,
      'View Milestones', portalUrl,
    ),
  };
}

export function tplNewMessage(name: string, portalUrl: string) {
  return {
    subject: `New message from the ${BRAND.name} team`,
    html: rnEmailShell(
      `You have a new message`,
      `<p>Hi ${name},</p>
       <p>The ${BRAND.name} team has sent you a new message on your project portal.</p>`,
      'Read & Reply', portalUrl,
    ),
  };
}

export function tplInvoiceCreated(name: string, invoiceNumber: string, amountLabel: string, portalUrl: string, invoiceUrl: string) {
  return {
    subject: `New Invoice from ${BRAND.name}: ${invoiceNumber}`,
    html: rnEmailShell(
      'Invoice Ready',
      `<p>Hi ${name},</p>
       <p>A new invoice (<strong>${invoiceNumber}</strong>) for <strong>${amountLabel}</strong> has been created for your account.</p>
       <p>You can view the details and pay securely using the link below, or access it from your client portal.</p>`,
      'View Invoice & Pay', invoiceUrl,
    ),
  };
}

export function portalUrlFor(magicToken: string | null): string {
  return magicToken ? `${APP_URL()}/rn/portal/${magicToken}` : APP_URL();
}
