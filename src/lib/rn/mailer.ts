import nodemailer from 'nodemailer';
import { prisma as db } from '@/lib/db';
import * as React from 'react';

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

export interface RnSendArgs {
  clientId: string;
  to: string;
  subject: string;
  html: string | React.ReactElement;
  trigger: string;
  sentBy?: string;
  metadata?: Record<string, unknown>;
}

export async function sendRnEmail(args: RnSendArgs): Promise<{ ok: boolean; error?: string }> {
  let { clientId, to, subject, html, trigger, sentBy = 'system', metadata } = args;

  // If HTML is a React element, render it to string
  if (typeof html === 'object' && html !== null && 'type' in html) {
    const { render } = await import('@react-email/render');
    html = await render(html as React.ReactElement);
  }

  const finalHtml = html as string;

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
          html: finalHtml,
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
    const info = await getTransport().sendMail({ from: fromAddress(), to, subject, html: finalHtml });
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
// ENTERPRISE TEMPLATES (React Email)
// ─────────────────────────────────────────────────────────────────

import { RnWelcomeEmail } from '@/emails/rn/RnWelcomeEmail';
import { RnMilestonePaymentEmail } from '@/emails/rn/RnMilestonePaymentEmail';
import { RnGenericEmail } from '@/emails/rn/RnGenericEmail';

export function tplGeneric(subject: string, title: string, preview: string, heading: string, paragraphs: string[], ctaLabel?: string, ctaUrl?: string) {
  return {
    subject,
    html: React.createElement(RnGenericEmail, { title, preview, heading, paragraphs, ctaLabel, ctaUrl }) as any,
  };
}

export function tplWelcome(name: string, portalUrl: string) {
  return {
    subject: `Welcome to ${BRAND.name} — Your Enterprise Project Portal`,
    html: React.createElement(RnWelcomeEmail, { 
      clientName: name, 
      projectName: 'Ripple Nexus Engagement', 
      portalUrl 
    }) as any,
  };
}

export function tplMilestonePaymentRequest(name: string, milestoneTitle: string, amountLabel: string, portalUrl: string, invoiceUrl?: string) {
  return {
    subject: `Payment Request: ${milestoneTitle}`,
    html: React.createElement(RnMilestonePaymentEmail, { 
      clientName: name, 
      milestoneTitle, 
      amountFormatted: amountLabel, 
      portalUrl, 
      invoiceUrl 
    }) as any,
  };
}

export function tplPaymentReceived(name: string, amountLabel: string, portalUrl: string) {
  return {
    subject: `Payment Received: ${amountLabel}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Payment Successful',
      preview: `We have successfully received your payment of ${amountLabel}.`,
      heading: 'Payment Received',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We have successfully received your payment of ${amountLabel}. Your receipt has been generated and is now available in your document center.`
      ],
      ctaLabel: 'View Receipt',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplMilestoneStarted(name: string, milestoneTitle: string, portalUrl: string) {
  return {
    subject: `Milestone Started: ${milestoneTitle}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Milestone In Progress',
      preview: `Work has officially begun on ${milestoneTitle}.`,
      heading: 'Milestone Started',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `Work has officially begun on the milestone: ${milestoneTitle}.`,
        `You can track real-time progress, tasks, and ETAs directly from your project dashboard.`
      ],
      ctaLabel: 'Track Progress',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplMilestoneCompleted(name: string, milestoneTitle: string, portalUrl: string) {
  return {
    subject: `Milestone Completed: ${milestoneTitle}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Milestone Completed',
      preview: `We've successfully completed the milestone ${milestoneTitle}.`,
      heading: 'Milestone Completed',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We've successfully completed the milestone: ${milestoneTitle}.`,
        `Please review the associated deliverables in your portal and approve them to proceed.`
      ],
      ctaLabel: 'Review Milestone',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplDeliverableUploaded(name: string, label: string, portalUrl: string) {
  return {
    subject: `Review Required: ${label}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Deliverable Ready For Review',
      preview: `We've uploaded ${label} to your secure workspace.`,
      heading: 'Document Review Required',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We've uploaded ${label} to your secure workspace.`,
        `Please review the document and provide your feedback or approval.`
      ],
      ctaLabel: 'Review Document',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplRevisionRequested(name: string, label: string, portalUrl: string) {
  return {
    subject: `Revision Requested: ${label}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Revision Requested',
      preview: `A revision has been requested for ${label}.`,
      heading: 'Revision Requested',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `Your revision request for ${label} has been received.`,
        `Our team will review your notes and begin working on the updates.`
      ],
      ctaLabel: 'View in Portal',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplRevisionDelivered(name: string, label: string, portalUrl: string) {
  return {
    subject: `Revision Ready: ${label}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Revision Delivered',
      preview: `The requested revision for ${label} is ready for review.`,
      heading: 'Revision Ready',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `The requested revision for ${label} is now complete and ready for your review.`
      ],
      ctaLabel: 'Review Document',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplNewMessage(name: string, portalUrl: string) {
  return {
    subject: `New Message from Ripple Nexus`,
    html: React.createElement(RnGenericEmail, { 
      title: 'New Message',
      preview: `You have a new message from the Ripple Nexus team.`,
      heading: 'New Message Received',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `You have received a new message regarding your project.`
      ],
      ctaLabel: 'Read Message',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplProjectStarted(name: string, projectName: string, portalUrl: string) {
  return {
    subject: `Project Kickoff: ${projectName}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Project Kickoff',
      preview: `We are officially kicking off ${projectName}.`,
      heading: 'Project Kickoff',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We are officially kicking off your project: ${projectName}.`,
        `Your dashboard has been updated with the initial timeline and milestones.`
      ],
      ctaLabel: 'View Dashboard',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplProjectCompleted(name: string, projectName: string, portalUrl: string) {
  return {
    subject: `Project Completed: ${projectName}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Project Completed',
      preview: `Congratulations! ${projectName} has been successfully completed.`,
      heading: 'Project Completed',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `Congratulations! We have successfully completed all milestones and deliverables for ${projectName}.`,
        `It has been a pleasure working with you. Your portal will remain active for your records.`
      ],
      ctaLabel: 'Access Portal',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplFeedbackRequest(name: string, portalUrl: string) {
  return {
    subject: `How did we do?`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Feedback Request',
      preview: `We would love to hear your thoughts on our engagement.`,
      heading: 'Share Your Feedback',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We would love to hear your thoughts on our recent engagement.`,
        `Your feedback helps us continuously improve our services.`
      ],
      ctaLabel: 'Provide Feedback',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplStageAdvanced(name: string, serviceName: string, newStage: string, portalUrl: string) {
  return {
    subject: `Project Update: Stage Advanced to ${newStage}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Project Update',
      preview: `Your project has advanced to ${newStage}.`,
      heading: 'Stage Advanced',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `Your project (${serviceName}) has successfully advanced to the next stage: ${newStage}.`
      ],
      ctaLabel: 'View Project Status',
      ctaUrl: portalUrl
    }) as any,
  };
}

export function tplInvoiceCreated(name: string, invoiceNumber: string, amountLabel: string, portalUrl: string, invoiceUrl: string) {
  return {
    subject: `Invoice Created: ${invoiceNumber}`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Invoice Created',
      preview: `A new invoice (${invoiceNumber}) has been generated for your account.`,
      heading: 'Invoice Created',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `A new invoice has been generated for your account.`
      ],
      metadata: { 'Invoice Number': invoiceNumber, 'Amount Due': amountLabel },
      ctaLabel: 'View & Pay Invoice',
      ctaUrl: invoiceUrl
    }) as any,
  };
}

export function tplPasswordReset(name: string, resetUrl: string) {
  return {
    subject: `Password Reset Request`,
    html: React.createElement(RnGenericEmail, { 
      title: 'Security Notice',
      preview: `A password reset was requested for your account.`,
      heading: 'Password Reset',
      paragraphs: [
        `Hi ${name.split(' ')[0]},`,
        `We received a request to reset your password. If you didn't make this request, you can safely ignore this email.`
      ],
      ctaLabel: 'Reset Password',
      ctaUrl: resetUrl
    }) as any,
  };
}
