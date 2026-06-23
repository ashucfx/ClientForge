// POST /api/admin/career/email-logs/resend
// Re-dispatches a career email for a given log entry.
// Supported triggers: MESSAGE_NOTIFY wrappers (GHOST_WARNING, REVIEW_REQUEST, etc.)
// Complex triggers (DRAFT_READY, FINAL_DELIVERY) return a helpful error.

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { processCareerEmail } from '@/lib/career/email';
import { PORTAL_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPLEX_TRIGGERS = new Set([
  'DRAFT_READY', 'LINKEDIN_DRAFT', 'REVISED_DRAFT', 'FINAL_DELIVERY',
  'REVISION', 'LOGIN_LINK', 'DELETE_OTP',
]);

function buildMessageData(trigger: string, client: { name: string; email: string }) {
  const firstName = client.name.split(' ')[0];
  const base = {
    recipientName: client.name,
    senderType: 'admin' as const,
    portalUrl: `${PORTAL_URL}/portal/dashboard`,
  };

  switch (trigger) {
    case 'WELCOME':
      return { subject: `Welcome to Catalyst — let's get started`, ...base,
        body: `Hi ${firstName},\n\nWelcome to Catalyst! We're excited to have you on board. Log in to your client portal to get started.` };
    case 'FORM_CONFIRM':
      return { subject: 'Your intake form has been received', ...base,
        body: `Hi ${firstName},\n\nWe've received your intake form. Our team will review it and get started on your documents soon.` };
    case 'REVIEW_REQUEST':
      return { ...base, portalUrl: 'https://www.trustpilot.com/evaluate/theripplenexus.com',
        subject: 'How did we do?',
        body: `Hi ${firstName},\n\nHope your job search is going great! If you loved our service, could you spare a minute to leave a review? It really helps us.` };
    case 'GHOST_WARNING':
      return { subject: 'Action Required: Your Revision Window is Closing Soon', ...base,
        body: `Hi ${firstName},\n\nJust a reminder — your draft was sent a while ago and your revision window is closing soon. Please log in to review your documents and request any final changes.` };
    case 'GHOST_CLOSURE':
      return { subject: 'Your order has been finalised', ...base,
        body: `Hi ${firstName},\n\nWe've finalised your order. If you'd like to request further revisions, please get in touch.` };
    case 'STALE_REMINDER':
      return { subject: 'Your profile is ready — just one more step', ...base,
        body: `Hi ${firstName},\n\nA quick nudge! Your career documents are ready and waiting. Log in to your portal to review them and get your application moving.` };
    case 'DRAFT_REMINDER':
      return { subject: 'Your draft is ready for review', ...base,
        body: `Hi ${firstName},\n\nYour draft is ready! Log in to your client portal to review it and share your feedback.` };
    case 'KEEP_WARM':
      return { subject: "We're still here when you're ready", ...base,
        body: `Hi ${firstName},\n\nJust checking in! Your documents are ready whenever you are. Log in to your portal anytime to continue.` };
    case 'UPSELL_PITCH':
      return { subject: 'Enhance your career package', ...base,
        body: `Hi ${firstName},\n\nWe noticed you might benefit from additional services. Log in to your portal to explore our full range of career solutions.` };
    case 'REVISION_EXPIRING':
      return { subject: 'Your revision window is expiring soon', ...base,
        body: `Hi ${firstName},\n\nJust a heads up — your revision window closes in 2 days. If you'd like any final changes, please log in and submit them now.` };
    case 'LINKEDIN_SECURITY':
      return { subject: 'Your LinkedIn credentials', ...base,
        body: `Hi ${firstName},\n\nThis is a reminder about your LinkedIn profile update. Please log in to your portal for further details.` };
    case 'MESSAGE_NOTIFY':
      return { subject: 'You have a new message from Catalyst', ...base,
        body: `Hi ${firstName},\n\nYou have a new message from the Catalyst team. Log in to your portal to read and reply.` };
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { logId } = await req.json().catch(() => ({}));
  if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });

  const log = await db.careerEmailLog.findUnique({
    where: { id: logId },
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  if (!log) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });

  if (COMPLEX_TRIGGERS.has(log.trigger)) {
    return NextResponse.json({
      ok: false,
      error: `Cannot auto-resend "${log.trigger}" — it requires document context. Use the client page to re-trigger.`,
    }, { status: 422 });
  }

  const messageData = buildMessageData(log.trigger, log.client);
  if (!messageData) {
    return NextResponse.json({
      ok: false,
      error: `No resend template for trigger "${log.trigger}".`,
    }, { status: 422 });
  }

  // Delete old log entry so unique constraint doesn't block re-insert
  await db.careerEmailLog.delete({ where: { id: logId } }).catch(() => null);

  try {
    await processCareerEmail({
      to: log.client.email,
      trigger: 'MESSAGE_NOTIFY',
      clientId: log.client.id,
      data: messageData,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend] Failed to resend career email:', err);
    return NextResponse.json({ ok: false, error: 'Send failed — check server logs' }, { status: 500 });
  }
}
