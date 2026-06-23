/**
 * Notification & email dispatch for sales funnel events.
 * Handles: inquiry confirmation, proposal emails, post-payment welcome, admin alerts.
 */

import { prisma as db } from '@/lib/db';
import { getBrand } from '@/lib/brand/registry';
import { ADMIN_EMAIL, PORTAL_URL } from '@/lib/config';
import * as React from 'react';
import { render } from '@react-email/render';
import { InquiryConfirmationEmail } from '@/emails/sales/InquiryConfirmationEmail';
import { AdminNewLeadEmail } from '@/emails/sales/AdminNewLeadEmail';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

// ─── Helper: send email via Resend ───
async function sendEmail(opts: {
  from: string;
  replyTo: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  tags?: { name: string; value: string }[];
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: opts.from,
      reply_to: opts.replyTo,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: {
        'List-Unsubscribe': `<mailto:${opts.replyTo}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: opts.tags,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error('Email send failed:', err);
  }
}

// ─── 1. Send inquiry confirmation to visitor ───
export async function sendInquiryConfirmationEmail(inquiry: {
  name: string;
  email: string;
  displayId: string;
  requirementType: string;
  servicesRequested: string[];
}) {
  const brand = getBrand('catalyst');
  const firstName = inquiry.name.split(' ')[0];

  const html = await render(React.createElement(InquiryConfirmationEmail, {
    name: inquiry.name,
    email: inquiry.email,
    displayId: inquiry.displayId,
    requirementType: inquiry.requirementType,
    servicesRequested: inquiry.servicesRequested,
  })).catch(() => buildLegacyInquiryConfirmationHTML({ brand, firstName, inquiry }));

  const text = `Hi ${firstName},

Your inquiry has been received.
Reference: ${inquiry.displayId}

What happens next:
1. Our team reviews your requirements within 24 hours
2. You'll receive a tailored proposal
3. Once approved, your client portal is activated

No payment is required at this stage.

Need instant checkout? Visit ${PORTAL_URL}/checkout

— ${brand.name}`;

  await sendEmail({
    from: `${brand.name} <${brand.fromEmail}>`,
    replyTo: brand.replyTo,
    to: [inquiry.email],
    subject: `Inquiry Received — ${inquiry.displayId} | ${brand.name}`,
    html,
    text,
    tags: [
      { name: 'type', value: 'inquiry_confirmation' },
      { name: 'inquiry_id', value: inquiry.displayId },
    ],
  });
}

function buildLegacyInquiryConfirmationHTML(opts: {
  brand: ReturnType<typeof getBrand>;
  firstName: string;
  inquiry: { name: string; displayId: string; requirementType: string; servicesRequested: string[] };
}): string {
  const { brand, firstName, inquiry } = opts;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:24px;background:#F0EDE6;font-family:Helvetica,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;"><h1 style="font-size:24px;color:#0A0B0D;">Inquiry Received</h1><p>Hello ${firstName}, your inquiry has been received. Reference: <strong style="color:#b8935b;">${inquiry.displayId}</strong></p><p>Our team will review and respond within 24 hours.</p><p style="font-size:12px;color:#9ca3af;">${brand.name} · <a href="mailto:${brand.replyTo}" style="color:#9ca3af;">${brand.replyTo}</a></p></div></body></html>`;
}

// ─── 2. Notify admin of new lead ───
export async function notifyAdminNewLead(inquiry: {
  id: string;
  displayId: string;
  name: string;
  email: string;
  requirementType: string;
  autoQualScore?: number | null;
  priority: string;
}) {
  // Create in-app notification for all admins
  const admins = await db.adminUser.findMany({
    where: { isActive: true, brandAccess: { has: 'catalyst' } },
    select: { id: true },
  });

  await db.notification.createMany({
    data: admins.map((admin) => ({
      adminId: admin.id,
      title: `New Sales Inquiry: ${inquiry.displayId}`,
      message: `${inquiry.name} (${inquiry.email}) — ${inquiry.requirementType.replace(/_/g, ' ')} · Score: ${inquiry.autoQualScore ?? 'N/A'} · Priority: ${inquiry.priority}`,
      link: `/sales/inquiries/${inquiry.id}`,
      type: 'INFO',
    })),
  });

  // Also send email to admin
  const brand = getBrand('catalyst');
  const adminHtml = await render(React.createElement(AdminNewLeadEmail, {
    id: inquiry.id,
    displayId: inquiry.displayId,
    name: inquiry.name,
    email: inquiry.email,
    requirementType: inquiry.requirementType,
    autoQualScore: inquiry.autoQualScore,
    priority: inquiry.priority,
  })).catch(() =>
    `<div style="font-family:Helvetica,Arial,sans-serif;padding:20px;"><h2>New Sales Inquiry: ${inquiry.displayId}</h2><p><strong>Name:</strong> ${inquiry.name}</p><p><strong>Email:</strong> ${inquiry.email}</p><p><strong>Type:</strong> ${inquiry.requirementType.replace(/_/g, ' ')}</p><p><strong>Score:</strong> ${inquiry.autoQualScore ?? 'N/A'} / 100</p><p><strong>Priority:</strong> ${inquiry.priority}</p><p><a href="${PORTAL_URL}/sales/inquiries/${inquiry.id}" style="display:inline-block;background:#0A0B0D;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Review Lead →</a></p></div>`
  );
  await sendEmail({
    from: `${brand.name} Alerts <${brand.fromEmail}>`,
    replyTo: brand.replyTo,
    to: [ADMIN_EMAIL],
    subject: `🔔 New Lead: ${inquiry.displayId} — ${inquiry.name} (${inquiry.requirementType.replace(/_/g, ' ')})`,
    html: adminHtml,
    text: `New Sales Inquiry: ${inquiry.displayId}\nName: ${inquiry.name}\nEmail: ${inquiry.email}\nType: ${inquiry.requirementType}\nScore: ${inquiry.autoQualScore ?? 'N/A'}\n\nReview: ${PORTAL_URL}/sales/inquiries/${inquiry.id}`,
    tags: [
      { name: 'type', value: 'admin_new_lead' },
      { name: 'inquiry_id', value: inquiry.displayId },
    ],
  });
}

// ─── 3. Send proposal email to client ───
export async function sendProposalEmail(proposal: {
  id: string;
  publicToken: string;
  title: string;
  total: number;
  currency: string;
  currencySymbol: string;
  inquiry: { name: string; email: string };
}) {
  const brand = getBrand('catalyst');
  const firstName = proposal.inquiry.name.split(' ')[0];
  const proposalUrl = `${PORTAL_URL}/proposal/${proposal.publicToken}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F0EDE6;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0A0B0D 0%,#1a1a2e 100%);padding:32px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:20px;color:#F4F1EB;letter-spacing:2px;">CATALYST</div>
    </div>
    <div style="padding:32px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#0A0B0D;margin:0 0 12px;">Your Proposal is Ready</h1>
      <p style="font-size:15px;color:#4a5568;line-height:1.7;">
        Hello ${firstName}, we've prepared a proposal for <strong>${proposal.title}</strong>.
      </p>
      <div style="background:#F5F2EC;border-radius:12px;padding:20px;margin:20px 0;">
        <div style="font-size:11px;color:#7c8db5;text-transform:uppercase;letter-spacing:1.2px;">Proposed Total</div>
        <div style="font-size:28px;font-weight:800;color:#0A0B0D;margin-top:4px;">${proposal.currencySymbol}${proposal.total.toLocaleString()}</div>
        <div style="font-size:12px;color:#6b7280;">${proposal.currency}</div>
      </div>
      <a href="${proposalUrl}" style="display:block;background:#0A0B0D;color:#fff;padding:16px;text-align:center;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.5px;">
        View Proposal →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;text-align:center;">
        Review the scope, deliverables, and pricing. Accept or decline directly from the page.
      </p>
    </div>
  </div>
</div>
</body></html>`;

  const text = `Hi ${firstName},

Your proposal for "${proposal.title}" is ready.

Total: ${proposal.currencySymbol}${proposal.total.toLocaleString()} ${proposal.currency}

View and respond: ${proposalUrl}

— ${brand.name}`;

  await sendEmail({
    from: `${brand.name} <${brand.fromEmail}>`,
    replyTo: brand.replyTo,
    to: [proposal.inquiry.email],
    subject: `Your Proposal is Ready — ${proposal.title} | ${brand.name}`,
    html,
    text,
    tags: [
      { name: 'type', value: 'proposal_sent' },
      { name: 'proposal_id', value: proposal.id },
    ],
  });
}
