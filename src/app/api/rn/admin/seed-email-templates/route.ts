import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EMAIL_TEMPLATES = [
  {
    triggerEvent: 'WELCOME_EMAIL',
    subject: 'Welcome to Ripple Nexus — Your Project Portal is Ready 🚀',
    availableVariables: ['clientName', 'magicLink', 'projectName'],
    htmlBody: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; border-radius: 16px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 40px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800;">Welcome to Ripple Nexus</h1>
    <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">Your dedicated project workspace is now live.</p>
  </div>
  <div style="padding: 40px;">
    <p>Hi <strong>{{clientName}}</strong>,</p>
    <p>We've provisioned your exclusive client portal for <strong>{{projectName}}</strong>. You can now track milestones, view deliverables, and communicate with the team — all in one place.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{magicLink}}" style="background: linear-gradient(90deg, #3B82F6, #8B5CF6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Access Your Portal →</a>
    </div>
    <p style="font-size: 13px; color: #94A3B8;">If you have any questions, reply to this email directly. We are excited to deliver exceptional results for you.</p>
  </div>
  <div style="padding: 20px 40px; background: #1E293B; text-align: center; font-size: 12px; color: #64748B;">
    Ripple Nexus · Enterprise Technology Partners · <a href="https://theripplenexus.com" style="color: #3B82F6;">theripplenexus.com</a>
  </div>
</div>`
  },
  {
    triggerEvent: 'INVOICE_CREATED',
    subject: 'Invoice Ready — {{projectName}} Milestone Payment',
    availableVariables: ['clientName', 'projectName', 'amount', 'dueDate', 'paymentLink'],
    htmlBody: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; border-radius: 16px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 40px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800;">Invoice Ready</h1>
    <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">Milestone payment request for {{projectName}}</p>
  </div>
  <div style="padding: 40px;">
    <p>Hi <strong>{{clientName}}</strong>,</p>
    <p>A payment has been raised for the milestone completed on <strong>{{projectName}}</strong>.</p>
    <div style="background: #1E293B; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <div style="display: flex; justify-content: space-between;"><span style="color: #94A3B8;">Amount</span><strong>{{amount}}</strong></div>
      <div style="display: flex; justify-content: space-between; margin-top: 12px;"><span style="color: #94A3B8;">Due Date</span><strong>{{dueDate}}</strong></div>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{paymentLink}}" style="background: linear-gradient(90deg, #10B981, #059669); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Pay Now →</a>
    </div>
  </div>
  <div style="padding: 20px 40px; background: #1E293B; text-align: center; font-size: 12px; color: #64748B;">
    Ripple Nexus · Enterprise Technology Partners
  </div>
</div>`
  },
  {
    triggerEvent: 'MILESTONE_COMPLETED',
    subject: '🎉 Milestone Completed — {{milestoneName}}',
    availableVariables: ['clientName', 'projectName', 'milestoneName', 'portalLink'],
    htmlBody: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; border-radius: 16px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #F59E0B, #EF4444); padding: 40px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800;">Milestone Completed 🎉</h1>
    <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">{{milestoneName}} is done!</p>
  </div>
  <div style="padding: 40px;">
    <p>Hi <strong>{{clientName}}</strong>,</p>
    <p>Great news! We have successfully completed the <strong>{{milestoneName}}</strong> milestone on your project <strong>{{projectName}}</strong>.</p>
    <p>Please log into your portal to review and approve the deliverables before we move to the next phase.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{portalLink}}" style="background: linear-gradient(90deg, #F59E0B, #EF4444); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Review Deliverables →</a>
    </div>
  </div>
  <div style="padding: 20px 40px; background: #1E293B; text-align: center; font-size: 12px; color: #64748B;">
    Ripple Nexus · Enterprise Technology Partners
  </div>
</div>`
  },
  {
    triggerEvent: 'PROJECT_DELIVERED',
    subject: '🚀 Project Delivered — {{projectName}}',
    availableVariables: ['clientName', 'projectName', 'portalLink'],
    htmlBody: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #E2E8F0; border-radius: 16px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #8B5CF6, #3B82F6); padding: 40px; text-align: center;">
    <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 800;">Project Delivered! 🚀</h1>
    <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">{{projectName}} is complete and live</p>
  </div>
  <div style="padding: 40px;">
    <p>Hi <strong>{{clientName}}</strong>,</p>
    <p>We are thrilled to announce that <strong>{{projectName}}</strong> has been fully delivered. It has been a pleasure working with you!</p>
    <p>All final assets, documentation, and handover notes are available in your portal.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{portalLink}}" style="background: linear-gradient(90deg, #8B5CF6, #3B82F6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">View Final Delivery →</a>
    </div>
    <p style="font-size: 13px; color: #94A3B8;">We would love a testimonial if you are happy with the results. Thank you for trusting Ripple Nexus.</p>
  </div>
  <div style="padding: 20px 40px; background: #1E293B; text-align: center; font-size: 12px; color: #64748B;">
    Ripple Nexus · Enterprise Technology Partners
  </div>
</div>`
  }
];

export async function POST(req: Request) {
  try {
    const admin = await requireRnAdmin();
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN only' }, { status: 403 });
    }

    // Wipe and re-seed
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
