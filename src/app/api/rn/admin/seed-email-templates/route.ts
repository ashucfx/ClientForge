import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const btn = (text: string, href: string, color = 'linear-gradient(90deg, #3B82F6, #8B5CF6)') =>
  `<div style="text-align:center;margin:32px 0"><a href="${href}" style="background:${color};color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px">${text}</a></div>`;

const shell = (gradient: string, title: string, subtitle: string, body: string) => `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0F172A;color:#E2E8F0;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
  <div style="background:${gradient};padding:44px 40px;text-align:center">
    <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:56px;font-size:28px;margin-bottom:16px">⬡</div>
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px">${title}</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:15px">${subtitle}</p>
  </div>
  <div style="padding:40px">${body}</div>
  <div style="padding:24px 40px;background:#1E293B;text-align:center;border-top:1px solid #334155">
    <p style="margin:0;font-size:12px;color:#64748B">Ripple Nexus · Enterprise Technology Partners · <a href="https://theripplenexus.com" style="color:#7C5CFF;text-decoration:none">theripplenexus.com</a></p>
    <p style="margin:8px 0 0;font-size:11px;color:#475569">Ripple Nexus, India · You received this because you are a registered client.</p>
  </div>
</div>`;

const p = (text: string) => `<p style="color:#CBD5E1;font-size:15px;line-height:1.7;margin:0 0 16px">${text}</p>`;
const card = (rows: [string, string][]) => `
<div style="background:#1E293B;border-radius:14px;padding:24px;margin:24px 0">
  ${rows.map(([label, val]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #334155"><span style="color:#94A3B8;font-size:14px">${label}</span><strong style="color:#E2E8F0;font-size:14px">${val}</strong></div>`).join('')}
</div>`;

const DEFAULT_EMAIL_TEMPLATES = [
  {
    triggerEvent: 'WELCOME_EMAIL',
    subject: '🚀 Welcome to Ripple Nexus — Your Project Portal is Live!',
    availableVariables: ['clientName', 'projectName', 'magicLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#7C5CFF,#3B82F6)',
      'Welcome to Ripple Nexus',
      'Your dedicated project workspace is now live',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('We\'ve provisioned your exclusive client portal for <strong>{{projectName}}</strong>. Track milestones, view deliverables, send messages, and approve work — all in one place.')}
       ${btn('Access Your Portal →', '{{magicLink}}')}
       ${p('If you have any questions, just reply to this email. We\'re excited to deliver exceptional results for you.')}`
    )
  },
  {
    triggerEvent: 'INVOICE_CREATED',
    subject: '🧾 Invoice Ready — {{projectName}} ({{amount}})',
    availableVariables: ['clientName', 'projectName', 'amount', 'dueDate', 'paymentLink', 'milestoneName'],
    htmlBody: shell(
      'linear-gradient(135deg,#10B981,#059669)',
      'Invoice Ready',
      '{{milestoneName}} — {{projectName}}',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('A payment has been raised for the milestone completed on your project.')}
       ${card([['Project', '{{projectName}}'], ['Milestone', '{{milestoneName}}'], ['Amount', '<span style="color:#10B981;font-size:18px;font-weight:800">{{amount}}</span>'], ['Due Date', '{{dueDate}}'], ['Status', '<span style="background:rgba(245,158,11,0.2);color:#F59E0B;padding:3px 10px;border-radius:20px;font-size:12px">Pending</span>']])}
       ${btn('Pay Now →', '{{paymentLink}}', 'linear-gradient(90deg,#10B981,#059669)')}`
    )
  },
  {
    triggerEvent: 'INVOICE_PAID',
    subject: '✅ Payment Confirmed — Thank You, {{clientName}}!',
    availableVariables: ['clientName', 'projectName', 'amount', 'milestoneName', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#059669,#10B981)',
      'Payment Confirmed ✅',
      'Thank you for your timely payment',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('We\'ve received your payment for <strong>{{milestoneName}}</strong>. Thank you!')}
       ${card([['Project', '{{projectName}}'], ['Milestone', '{{milestoneName}}'], ['Amount Paid', '<span style="color:#10B981;font-weight:800">{{amount}}</span>'], ['Status', '<span style="background:rgba(16,185,129,0.15);color:#10B981;padding:3px 10px;border-radius:20px;font-size:12px">Paid</span>']])}
       ${btn('View Portal', '{{portalLink}}', 'linear-gradient(90deg,#059669,#10B981)')}`
    )
  },
  {
    triggerEvent: 'INVOICE_REMINDER',
    subject: '⏰ Payment Reminder — {{milestoneName}} Due {{dueDate}}',
    availableVariables: ['clientName', 'projectName', 'amount', 'dueDate', 'paymentLink', 'milestoneName'],
    htmlBody: shell(
      'linear-gradient(135deg,#F59E0B,#EF4444)',
      'Payment Reminder ⏰',
      'Action required — due {{dueDate}}',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('This is a friendly reminder that your invoice for <strong>{{milestoneName}}</strong> on <strong>{{projectName}}</strong> is due on <strong>{{dueDate}}</strong>.')}
       ${card([['Amount', '<span style="color:#F59E0B;font-size:18px;font-weight:800">{{amount}}</span>'], ['Due', '{{dueDate}}'], ['Status', '<span style="background:rgba(245,158,11,0.15);color:#F59E0B;padding:3px 10px;border-radius:20px;font-size:12px">Pending</span>']])}
       ${btn('Pay Now →', '{{paymentLink}}', 'linear-gradient(90deg,#F59E0B,#EF4444)')}`
    )
  },
  {
    triggerEvent: 'INVOICE_OVERDUE',
    subject: '🚨 Overdue Invoice — {{projectName}} ({{amount}})',
    availableVariables: ['clientName', 'projectName', 'amount', 'dueDate', 'paymentLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#EF4444,#DC2626)',
      'Invoice Overdue 🚨',
      'Immediate action required',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('Your invoice for <strong>{{projectName}}</strong> was due on <strong>{{dueDate}}</strong> and remains unpaid. Please settle this at your earliest convenience to avoid any project delays.')}
       ${card([['Amount Overdue', '<span style="color:#EF4444;font-size:18px;font-weight:800">{{amount}}</span>'], ['Originally Due', '{{dueDate}}'], ['Status', '<span style="background:rgba(239,68,68,0.15);color:#EF4444;padding:3px 10px;border-radius:20px;font-size:12px">OVERDUE</span>']])}
       ${btn('Pay Immediately →', '{{paymentLink}}', 'linear-gradient(90deg,#EF4444,#DC2626)')}`
    )
  },
  {
    triggerEvent: 'MILESTONE_COMPLETED',
    subject: '🎉 Milestone Completed — {{milestoneName}}',
    availableVariables: ['clientName', 'projectName', 'milestoneName', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#F59E0B,#EF4444)',
      '🎉 Milestone Complete!',
      '{{milestoneName}} is done and ready for review',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('We\'re thrilled to announce the completion of the <strong>{{milestoneName}}</strong> milestone on your project <strong>{{projectName}}</strong>.')}
       ${p('Please log into your portal to review the deliverables and provide your approval so we can proceed to the next phase.')}
       ${btn('Review Deliverables →', '{{portalLink}}', 'linear-gradient(90deg,#F59E0B,#EF4444)')}`
    )
  },
  {
    triggerEvent: 'MILESTONE_APPROVED',
    subject: '✅ Milestone Approved — Moving to Next Phase!',
    availableVariables: ['clientName', 'projectName', 'milestoneName', 'nextMilestoneName', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#7C5CFF,#10B981)',
      'Milestone Approved ✅',
      'Moving to next phase',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('Thank you for approving <strong>{{milestoneName}}</strong>! We\'re now moving into <strong>{{nextMilestoneName}}</strong>.')}
       ${btn('View Progress →', '{{portalLink}}')}`
    )
  },
  {
    triggerEvent: 'PROJECT_DELIVERED',
    subject: '🚀 {{projectName}} — Project Fully Delivered!',
    availableVariables: ['clientName', 'projectName', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#8B5CF6,#3B82F6)',
      'Project Delivered! 🚀',
      '{{projectName}} is complete and live',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('We\'re thrilled to announce that <strong>{{projectName}}</strong> has been fully delivered! It has been an absolute pleasure working with you.')}
       ${p('All final assets, documentation, and handover notes are available in your portal.')}
       ${btn('View Final Delivery →', '{{portalLink}}', 'linear-gradient(90deg,#8B5CF6,#3B82F6)')}
       ${p('We would love a testimonial if you are happy with the results. Thank you for trusting Ripple Nexus.')}`
    )
  },
  {
    triggerEvent: 'NEW_MESSAGE',
    subject: '💬 New Message on {{projectName}}',
    availableVariables: ['clientName', 'projectName', 'senderName', 'messagePreview', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#3B82F6,#06B6D4)',
      'New Message 💬',
      'From {{senderName}} on {{projectName}}',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('<strong>{{senderName}}</strong> has sent you a message on <strong>{{projectName}}</strong>:')}
       <blockquote style="border-left:3px solid #7C5CFF;padding:12px 20px;background:#1E293B;border-radius:0 10px 10px 0;margin:20px 0;color:#CBD5E1;font-style:italic">"{{messagePreview}}"</blockquote>
       ${btn('Reply in Portal →', '{{portalLink}}', 'linear-gradient(90deg,#3B82F6,#06B6D4)')}`
    )
  },
  {
    triggerEvent: 'DELIVERABLE_UPLOADED',
    subject: '📁 New Deliverable Uploaded — {{projectName}}',
    availableVariables: ['clientName', 'projectName', 'deliverableName', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#7C5CFF,#8B5CF6)',
      'Deliverable Uploaded 📁',
      '{{deliverableName}} is ready for review',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('A new deliverable has been uploaded to your project <strong>{{projectName}}</strong>: <strong>{{deliverableName}}</strong>.')}
       ${p('Please log in to review, download, and provide your approval or feedback.')}
       ${btn('Review Deliverable →', '{{portalLink}}')}`
    )
  },
  {
    triggerEvent: 'PROJECT_ON_HOLD',
    subject: '⏸️ Project On Hold — {{projectName}}',
    availableVariables: ['clientName', 'projectName', 'reason', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#6B7280,#374151)',
      'Project Paused ⏸️',
      'Action required to resume',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('We have temporarily paused work on <strong>{{projectName}}</strong>. Reason: <strong>{{reason}}</strong>.')}
       ${p('Please log in to your portal or reply to this email to discuss the next steps.')}
       ${btn('View Project →', '{{portalLink}}', 'linear-gradient(90deg,#6B7280,#374151)')}`
    )
  },
  {
    triggerEvent: 'RETAINER_RENEWAL',
    subject: '🔄 Retainer Renewal — {{projectName}}',
    availableVariables: ['clientName', 'projectName', 'amount', 'renewalDate', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#7C5CFF,#F59E0B)',
      'Retainer Renewal 🔄',
      'Your retainer is up for renewal',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('Your retainer for <strong>{{projectName}}</strong> is due for renewal on <strong>{{renewalDate}}</strong>.')}
       ${card([['Project', '{{projectName}}'], ['Monthly Amount', '<span style="color:#7C5CFF;font-weight:800">{{amount}}</span>'], ['Renewal Date', '{{renewalDate}}']])}
       ${btn('Renew Retainer →', '{{portalLink}}')}`
    )
  },
  {
    triggerEvent: 'REVIEW_REQUESTED',
    subject: '⭐ Quick Favour — Share Your Experience with Ripple Nexus',
    availableVariables: ['clientName', 'projectName', 'reviewLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#F59E0B,#7C5CFF)',
      'Share Your Experience ⭐',
      'We\'d love to hear from you',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('Working on <strong>{{projectName}}</strong> with you has been an incredible experience. If you\'re happy with the results, we\'d be deeply grateful for a review or testimonial.')}
       ${p('It takes just 2 minutes and helps other businesses discover us.')}
       ${btn('Leave a Review →', '{{reviewLink}}', 'linear-gradient(90deg,#F59E0B,#7C5CFF)')}`
    )
  },
  {
    triggerEvent: 'CONTRACT_SIGNED',
    subject: '🤝 Contract Signed — {{projectName}} Officially Kicked Off!',
    availableVariables: ['clientName', 'projectName', 'startDate', 'portalLink'],
    htmlBody: shell(
      'linear-gradient(135deg,#10B981,#7C5CFF)',
      'Contract Signed 🤝',
      '{{projectName}} is officially underway!',
      `${p('Hi <strong>{{clientName}}</strong>,')}
       ${p('The contract for <strong>{{projectName}}</strong> has been signed. We\'re officially kicking off on <strong>{{startDate}}</strong>!')}
       ${p('Your project portal has been provisioned. You can track every step of the journey from there.')}
       ${btn('Open Project Portal →', '{{portalLink}}', 'linear-gradient(90deg,#10B981,#7C5CFF)')}`
    )
  }
];

export async function POST(req: Request) {
  try {
    const admin = await requireRnAdmin();
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN only' }, { status: 403 });
    }
    await prisma.rnEmailTemplate.deleteMany({});
    const created = [];
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      const t = await prisma.rnEmailTemplate.create({ data: tpl });
      created.push(t.triggerEvent);
    }
    return NextResponse.json({ success: true, seeded: created.length, templates: created });
  } catch (err: any) {
    console.error('[seed-email-templates] Error:', err);
    return NextResponse.json({ error: err.message || 'Seed failed' }, { status: 500 });
  }
}
