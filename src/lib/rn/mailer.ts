// src/lib/rn/mailer.ts
import nodemailer from 'nodemailer';
import { prisma as db } from '@/lib/db';

const BRAND = {
  name: 'Ripple Nexus',
  violet: '#5E6AD2',
  obsidian: '#12131A',
  text: '#20222A',
  muted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
};

export function isRnSmtpConfigured(): boolean {
  return !!((process.env.RN_SMTP_HOST && process.env.RN_SMTP_USER && process.env.RN_SMTP_PASS) || 
            (process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.FROM_EMAIL)));
}

function getTransport() {
  const host = process.env.RN_SMTP_HOST || process.env.SMTP_HOST;
  const portStr = process.env.RN_SMTP_PORT || process.env.SMTP_PORT || '587';
  const port = Number(portStr);
  const secure = process.env.RN_SMTP_SECURE ? process.env.RN_SMTP_SECURE === 'true' : port === 465;
  const user = process.env.RN_SMTP_USER || process.env.SMTP_USER || process.env.FROM_EMAIL;
  const pass = process.env.RN_SMTP_PASS || process.env.SMTP_PASS;

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function fromAddress(): string {
  const user = process.env.RN_SMTP_USER || process.env.SMTP_USER || process.env.FROM_EMAIL;
  return process.env.RN_SMTP_FROM ?? `${BRAND.name} <${user}>`;
}

// ─────────────────────────────────────────────────────────────────
// PREMIUM ENTERPRISE EMAIL SHELL (Stripe / Linear / Vercel style)
// ─────────────────────────────────────────────────────────────────
export function rnEmailShell(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string, metadata?: Record<string, string>): string {
  const logoUrl = `${APP_URL()}/logos/rn/email-logo-dark.png`;
  
  let metadataHtml = '';
  if (metadata && Object.keys(metadata).length > 0) {
    metadataHtml = `<table style="width:100%;margin:24px 0;background:#F9FAFB;border-radius:8px;padding:16px;">`;
    for (const [key, val] of Object.entries(metadata)) {
      metadataHtml += `<tr>
        <td style="padding:6px 0;color:#6B7280;font-size:13px;width:120px;">${key}</td>
        <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${val}</td>
      </tr>`;
    }
    metadataHtml += `</table>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#F3F4F6; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif; -webkit-font-smoothing:antialiased; }
    .container { max-width:600px; margin:40px auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border:1px solid #E5E7EB; }
    .header { padding:32px 40px; border-bottom:1px solid #E5E7EB; text-align:center; background:#ffffff; }
    .content { padding:40px; color:#374151; font-size:15px; line-height:1.6; }
    h1 { margin:0 0 24px; font-size:24px; font-weight:600; color:#111827; letter-spacing:-0.5px; }
    p { margin:0 0 16px; }
    .button-wrap { margin:32px 0 16px; text-align:center; }
    .button { display:inline-block; background-color:#000000; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:6px; font-weight:500; font-size:15px; letter-spacing:0.3px; box-shadow:0 1px 2px rgba(0,0,0,0.1); }
    .footer { padding:32px 40px; background-color:#F9FAFB; border-top:1px solid #E5E7EB; text-align:center; color:#6B7280; font-size:12px; line-height:1.5; }
    .footer-links a { color:#6B7280; text-decoration:none; margin:0 8px; }
    .footer-links a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:40px 0;">
    <tr>
      <td align="center">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="${BRAND.name}" height="28" style="display:block;margin:0 auto;height:28px;width:auto;" />
          </div>
          <div class="content">
            <h1>${title}</h1>
            ${bodyHtml}
            ${metadataHtml}
            ${ctaLabel && ctaUrl ? `
            <div class="button-wrap">
              <a href="${ctaUrl}" class="button">${ctaLabel}</a>
            </div>` : ''}
          </div>
          <div class="footer">
            <p style="margin-bottom:12px;"><strong>${BRAND.name}</strong><br/>The Autonomous Enterprise Stack</p>
            <div class="footer-links">
              <a href="${APP_URL()}/contact">Support</a> • 
              <a href="${APP_URL()}/privacy">Privacy</a> • 
              <a href="${APP_URL()}/terms">Terms</a>
            </div>
            <p style="margin-top:16px;font-size:11px;color:#9CA3AF;">This is an automated operational email from your project workspace.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface RnSendArgs {
  clientId: string;
  to: string;
  subject: string;
  html: string;
  trigger: string;
  sentBy?: string;
  metadata?: Record<string, unknown>;
}

export async function sendRnEmail(args: RnSendArgs): Promise<{ ok: boolean; error?: string }> {
  const { clientId, to, subject, html, trigger, sentBy = 'system', metadata } = args;

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
          data: { clientId, trigger, status: 'sent', to, subject, provider: 'resend', resendId: (result as any)?.data?.id ?? null, sentBy, metadata: metadata as any },
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
    const error = 'SMTP not configured';
    await db.rnEmailLog.create({
      data: { clientId, trigger, status: 'failed', to, subject, provider: 'smtp', error, sentBy, metadata: metadata as any },
    }).catch(() => {});
    return { ok: false, error };
  }

  try {
    const info = await getTransport().sendMail({ from: fromAddress(), to, subject, html });
    await db.rnEmailLog.create({
      data: { clientId, trigger, status: 'sent', to, subject, provider: 'smtp', messageId: info.messageId ?? null, sentBy, metadata: metadata as any },
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message.slice(0, 500) : 'Send failed';
    await db.rnEmailLog.create({
      data: { clientId, trigger, status: 'failed', to, subject, provider: 'smtp', error, sentBy, metadata: metadata as any },
    }).catch(() => {});
    return { ok: false, error };
  }
}

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://clientforge.theripplenexus.com';
export function portalUrlFor(magicToken: string | null): string { return magicToken ? `${APP_URL()}/rn/portal/${magicToken}` : APP_URL(); }

// ─────────────────────────────────────────────────────────────────
// ENTERPRISE TEMPLATES
// ─────────────────────────────────────────────────────────────────

export function tplWelcome(name: string, portalUrl: string) {
  return {
    subject: `Welcome to ${BRAND.name} — Your Enterprise Project Portal`,
    html: rnEmailShell(
      `Welcome, ${name}`,
      `<p>Your dedicated enterprise workspace has been successfully provisioned.</p>
       <p>This secure portal serves as your centralized hub to track project milestones, manage payments, review deliverables, and communicate directly with our engineering and design teams.</p>
       <p>We look forward to delivering excellence and accelerating your business growth.</p>`,
      'Access Secure Portal', portalUrl
    ),
  };
}

export function tplMilestonePaymentRequest(name: string, milestoneTitle: string, amountLabel: string, portalUrl: string, invoiceUrl?: string) {
  const isRazorpay = invoiceUrl?.includes('rzp.io');
  return {
    subject: `Payment Request: ${milestoneTitle}`,
    html: rnEmailShell(
      'Payment Required',
      `<p>Dear ${name},</p>
       <p>The milestone <strong>${milestoneTitle}</strong> has been initiated and requires payment to proceed.</p>
       ${isRazorpay ? `<p>For your convenience and security, we process payments via Razorpay (supporting 100+ global currencies).</p>` : `<p>Please complete this transaction securely via your client portal.</p>`}`,
      isRazorpay ? 'Pay Now via Razorpay' : 'View Invoice & Pay',
      invoiceUrl ?? portalUrl,
      { 'Amount Due': amountLabel, 'Milestone': milestoneTitle, 'Status': 'Pending Payment' }
    ),
  };
}

export function tplPaymentReceived(name: string, amountLabel: string, portalUrl: string) {
  return {
    subject: `Payment Received: ${amountLabel}`,
    html: rnEmailShell(
      'Payment Successful',
      `<p>Hi ${name},</p><p>We have successfully received your payment of <strong>${amountLabel}</strong>. Your receipt has been generated and is now available in your document center.</p>`,
      'View Receipt', portalUrl
    ),
  };
}

export function tplMilestoneStarted(name: string, milestoneTitle: string, portalUrl: string) {
  return {
    subject: `Milestone Started: ${milestoneTitle}`,
    html: rnEmailShell(
      'Milestone In Progress',
      `<p>Hi ${name},</p><p>Work has officially begun on <strong>${milestoneTitle}</strong>.</p><p>You can track real-time progress, tasks, and ETAs directly from your project dashboard.</p>`,
      'Track Progress', portalUrl
    ),
  };
}

export function tplMilestoneCompleted(name: string, milestoneTitle: string, portalUrl: string) {
  return {
    subject: `Milestone Completed: ${milestoneTitle}`,
    html: rnEmailShell(
      'Milestone Completed',
      `<p>Hi ${name},</p><p>We've successfully completed the milestone <strong>${milestoneTitle}</strong>.</p><p>Please review the associated deliverables in your portal and approve them to proceed.</p>`,
      'Review Milestone', portalUrl
    ),
  };
}

export function tplDeliverableUploaded(name: string, label: string, portalUrl: string) {
  return {
    subject: `Review Required: ${label}`,
    html: rnEmailShell(
      'Deliverable Ready For Review',
      `<p>Hi ${name},</p><p>We've uploaded <strong>${label}</strong> to your secure workspace.</p><p>Please review the document and provide your feedback or approval.</p>`,
      'Review Document', portalUrl
    ),
  };
}

export function tplRevisionRequested(name: string, label: string, portalUrl: string) {
  return {
    subject: `Revision Requested: ${label}`,
    html: rnEmailShell(
      'Revision Logged',
      `<p>Hi ${name},</p><p>We have received your revision request for <strong>${label}</strong>.</p><p>Our team is reviewing the feedback and will update the deliverable shortly.</p>`,
      'View Workspace', portalUrl
    ),
  };
}

export function tplRevisionDelivered(name: string, label: string, portalUrl: string) {
  return {
    subject: `Revision Delivered: ${label}`,
    html: rnEmailShell(
      'Updated Deliverable Ready',
      `<p>Hi ${name},</p><p>The requested revisions for <strong>${label}</strong> have been completed.</p><p>Please review the updated version in your portal.</p>`,
      'Review Revision', portalUrl
    ),
  };
}

export function tplNewMessage(name: string, portalUrl: string) {
  return {
    subject: `New message from ${BRAND.name}`,
    html: rnEmailShell(
      'New Message Received',
      `<p>Hi ${name},</p><p>Your team has posted a new update in your project workspace.</p>`,
      'Read Message', portalUrl
    ),
  };
}

export function tplProjectStarted(name: string, projectName: string, portalUrl: string) {
  return {
    subject: `Project Kickoff: ${projectName}`,
    html: rnEmailShell(
      'Project Started',
      `<p>Hi ${name},</p><p>All requirements are met and <strong>${projectName}</strong> is now officially in progress!</p>`,
      'View Timeline', portalUrl
    ),
  };
}

export function tplProjectCompleted(name: string, projectName: string, portalUrl: string) {
  return {
    subject: `Project Completed: ${projectName}`,
    html: rnEmailShell(
      'Project Completed',
      `<p>Hi ${name},</p><p>Congratulations! <strong>${projectName}</strong> has reached the finish line.</p><p>All final deliverables are available for download in your portal.</p>`,
      'Access Deliverables', portalUrl
    ),
  };
}

export function tplFeedbackRequest(name: string, portalUrl: string) {
  return {
    subject: `How did we do?`,
    html: rnEmailShell(
      'Feedback Request',
      `<p>Hi ${name},</p><p>We hope you're thrilled with the outcome of your project. We'd love to hear your thoughts on the experience.</p>`,
      'Leave Feedback', portalUrl
    ),
  };
}

export function tplStageAdvanced(name: string, serviceName: string, newStage: string, portalUrl: string) {
  return {
    subject: `Update: ${serviceName} moved to ${newStage.replace(/_/g, ' ')}`,
    html: rnEmailShell(
      'Project Advanced',
      `<p>Hi ${name},</p><p>Your project has advanced to the <strong>${newStage.replace(/_/g, ' ')}</strong> phase.</p>`,
      'View Progress', portalUrl
    ),
  };
}

export function tplInvoiceCreated(name: string, invoiceNumber: string, amountLabel: string, portalUrl: string, invoiceUrl: string) {
  return {
    subject: `Invoice Available: ${invoiceNumber}`,
    html: rnEmailShell(
      'New Invoice',
      `<p>Hi ${name},</p><p>Invoice <strong>${invoiceNumber}</strong> is now available.</p>`,
      'Pay Now', invoiceUrl,
      { 'Invoice': invoiceNumber, 'Amount': amountLabel }
    ),
  };
}

export function tplPasswordReset(name: string, resetUrl: string) {
  return {
    subject: `Password Reset Request`,
    html: rnEmailShell(
      'Reset Password',
      `<p>Hi ${name},</p><p>We received a request to reset your portal password.</p><p>If you didn't make this request, you can safely ignore this email.</p>`,
      'Reset Password', resetUrl
    ),
  };
}
