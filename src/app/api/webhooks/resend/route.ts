import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resend webhook event types we handle
type ResendEvent =
  | 'email.bounced'
  | 'email.complained'   // spam complaint
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.unsubscribed';

interface ResendWebhookPayload {
  type: ResendEvent;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    bounce?: {
      type: 'soft' | 'hard';
      subtype?: string;
      message?: string;
    };
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // HMAC-SHA256 signature verification
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get('svix-signature') ?? '';
    // svix sends: "v1,<timestamp>.<hex-sig>" or multiple comma-separated
    const sigParts = sig.split(' ').flatMap(s => s.split(','));
    const ts = sigParts.find(p => p.startsWith('t='))?.slice(2) ?? '';
    const v1Sigs = sigParts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));

    const expectedPayload = `${ts}.${rawBody}`;
    const hmac = createHmac('sha256', Buffer.from(secret, 'base64'));
    hmac.update(expectedPayload);
    const expectedSig = hmac.digest('hex');

    const verified = v1Sigs.some(s => {
      try { return timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expectedSig, 'hex')); }
      catch { return false; }
    });

    if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, data } = payload;
  const toEmail = data.to?.[0]?.toLowerCase();
  if (!toEmail) return NextResponse.json({ ok: true });

  // Idempotency — skip if we already processed this email_id + event
  try {
    await db.processedEvent.create({
      data: { eventId: data.email_id, eventType: type },
    });
  } catch {
    // P2002 unique violation = already processed
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Find the contact by email
  const contact = await db.contact.findFirst({
    where: { email: { equals: toEmail, mode: 'insensitive' } },
    include: { flywheelProfile: true },
  });

  if (!contact) {
    // May be a CareerClient email not linked to a Contact — log but don't error
    console.warn('[ResendWebhook] No contact found for', toEmail, type);
    return NextResponse.json({ ok: true });
  }

  if (type === 'email.bounced') {
    const isHard = data.bounce?.type === 'hard';
    const metadata = {
      ...(contact.flywheelProfile?.metadata as Record<string, unknown> ?? {}),
      emailBounced: true,
      bounceType: data.bounce?.type ?? 'hard',
      bounceSubtype: data.bounce?.subtype,
      bounceMessage: data.bounce?.message,
      bounceAt: new Date().toISOString(),
    };

    if (contact.flywheelProfile) {
      await db.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: {
          // Hard bounce: opt out permanently. Soft bounce: just record.
          ...(isHard ? { optInStatus: false } : {}),
          metadata,
        },
      });
    }

    // Also log on CareerEmailLog if this was a career lifecycle email
    // (best-effort — CareerClient may not exist)
    if (isHard) {
      const careerClient = await db.careerClient.findFirst({
        where: { email: { equals: toEmail, mode: 'insensitive' } },
      });
      if (careerClient) {
        await db.careerActivityLog.create({
          data: {
            clientId: careerClient.id,
            action: 'email_hard_bounced',
            performedBy: 'system',
            metadata: { emailId: data.email_id, bounceType: data.bounce?.type },
          },
        }).catch(() => null);
      }
    }
  }

  if (type === 'email.complained') {
    // Spam complaint — always opt out
    const metadata = {
      ...(contact.flywheelProfile?.metadata as Record<string, unknown> ?? {}),
      spamComplaint: true,
      complaintAt: new Date().toISOString(),
    };
    if (contact.flywheelProfile) {
      await db.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: { optInStatus: false, metadata },
      });
    }
  }

  if (type === 'email.unsubscribed') {
    if (contact.flywheelProfile) {
      await db.flywheelProfile.update({
        where: { id: contact.flywheelProfile.id },
        data: { optInStatus: false },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
