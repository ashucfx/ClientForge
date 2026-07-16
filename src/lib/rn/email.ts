// src/lib/rn/email.ts
// Ripple Nexus transactional emails — routed through the RN SMTP mailer
// (src/lib/rn/mailer.ts) with full RnEmailLog logging. Signatures kept
// backwards-compatible with existing callers.

import { prisma as db } from '@/lib/db';
import { sendRnEmail, rnEmailShell, tplWelcome } from './mailer';

async function clientIdByEmail(email: string): Promise<string | null> {
  const c = await db.rnClient.findFirst({ where: { email }, select: { id: true } });
  return c?.id ?? null;
}

export async function sendRnOnboardingEmail(to: string, name: string, portalUrl: string) {
  const clientId = await clientIdByEmail(to);
  if (!clientId) return;
  const { subject, html } = tplWelcome(name, portalUrl);
  await sendRnEmail({ clientId, to, subject, html, trigger: 'welcome' });
}

export async function sendRnOtpEmail(to: string, otp: string) {
  const clientId = await clientIdByEmail(to);
  if (!clientId) return;
  await sendRnEmail({
    clientId,
    to,
    subject: 'Your Ripple Nexus login PIN',
    trigger: 'otp',
    html: rnEmailShell(
      'Login verification',
      `<p>Use this 6-digit PIN to securely log in to your Ripple Nexus client portal.</p>
       <div style="margin:24px 0;font-size:32px;font-weight:800;letter-spacing:6px;color:#7C5CFF;text-align:center;background:#F4F5FA;padding:20px;border-radius:12px">${otp}</div>
       <p style="color:#6B7394;font-size:12.5px">This PIN expires shortly. If you did not request it, you can safely ignore this email.</p>`,
    ),
  });
}
