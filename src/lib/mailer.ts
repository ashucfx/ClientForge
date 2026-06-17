// Unified email dispatch — routes to Resend (transactional) or SMTP (marketing).
// All outbound email should call sendEmail() rather than hitting Resend or nodemailer directly.

import nodemailer from 'nodemailer';
import { prisma as db } from '@/lib/db';

export type EmailChannel = 'transactional' | 'marketing';

export interface EmailPayload {
  to: string | string[];
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  channel?: EmailChannel;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string }>;
  tags?: Array<{ name: string; value: string }>;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let _smtpTransport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getSmtpTransport() {
  if (!_smtpTransport) {
    _smtpTransport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _smtpTransport;
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
  const body: Record<string, unknown> = {
    from:     payload.from,
    to:       Array.isArray(payload.to) ? payload.to : [payload.to],
    subject:  payload.subject,
    html:     payload.html,
    ...(payload.text    ? { text: payload.text } : {}),
    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    ...(payload.headers ? { headers: payload.headers } : {}),
    ...(payload.tags    ? { tags: payload.tags } : {}),
    ...(payload.attachments ? { attachments: payload.attachments } : {}),
  };
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
}

async function sendViaSmtp(payload: EmailPayload): Promise<void> {
  const transport = getSmtpTransport();
  await transport.sendMail({
    from:     payload.from,
    to:       payload.to,
    subject:  payload.subject,
    html:     payload.html,
    ...(payload.text    ? { text: payload.text } : {}),
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    ...(payload.headers ? { headers: payload.headers as Record<string, string> } : {}),
  });
}

export async function sendEmail(
  payload: EmailPayload,
  opts?: { trigger?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const channel = payload.channel ?? 'transactional';
  const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const trigger = opts?.trigger ?? (channel === 'marketing' ? 'MARKETING' : 'ADMIN_ALERT');

  try {
    if (channel === 'marketing') {
      await sendViaSmtp(payload);
    } else {
      await sendViaResend(payload);
    }
    db.sysEmailLog.create({
      data: { to, subject: payload.subject, trigger, channel, status: 'sent', metadata: opts?.metadata as any ?? null },
    }).catch(() => null);
  } catch (err) {
    db.sysEmailLog.create({
      data: {
        to, subject: payload.subject, trigger, channel, status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        metadata: opts?.metadata as any ?? null,
      },
    }).catch(() => null);
    throw err;
  }
}
