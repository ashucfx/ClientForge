import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma as db } from '@/lib/db';
import { createWithGeneratedDisplayId, nextContactDisplayId } from '@/lib/displayIds';

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const email = (body.email ?? '').toLowerCase().trim();
    const code  = (body.code  ?? '').trim();
    const token = (body.token ?? '').trim();

    if (!email || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const sig    = token.slice(0, dotIdx);
    const expStr = token.slice(dotIdx + 1);
    const exp    = parseInt(expStr, 10);

    if (isNaN(exp) || Date.now() > exp) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    const secret = process.env.CAREER_PORTAL_SECRET;
    if (!secret) throw new Error('CAREER_PORTAL_SECRET is not configured');

    const expected = createHmac('sha256', secret)
      .update(`${email}:${code}:${exp}`)
      .digest('hex');

    const sigBuf      = Buffer.from(sig,      'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    // Fire-and-forget: capture lead immediately so we don't lose the prospect
    void captureCheckoutLead({
      email,
      name:        (body.name        ?? '').trim(),
      phone:       (body.phone       ?? '').trim(),
      whatsapp:    (body.whatsapp    ?? '').trim(),
      tier:        (body.tier        ?? '').trim(),
      countryCode: (body.countryCode ?? 'XX').trim().toUpperCase(),
      countryName: (body.countryName ?? '').trim(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

async function captureCheckoutLead(data: {
  email: string; name: string; phone: string; whatsapp: string;
  tier: string; countryCode: string; countryName: string;
}) {
  try {
    let contact = await db.contact.findFirst({
      where: { email: { equals: data.email, mode: 'insensitive' } },
      include: { flywheelProfile: true },
    });

    if (!contact) {
      contact = await createWithGeneratedDisplayId(
        'displayId',
        () => nextContactDisplayId(db),
        (displayId) => db.contact.create({
          data: {
            displayId,
            name:          data.name || data.email.split('@')[0],
            email:         data.email,
            ...(data.phone    ? { phone: data.phone }       : {}),
            ...(data.whatsapp ? { whatsapp: data.whatsapp } : {}),
            ...(data.countryCode ? { country: data.countryCode } : {}),
            contactSource: 'WEBSITE_CHECKOUT',
          },
          include: { flywheelProfile: true },
        }),
      );
    } else {
      // Fill in missing fields only — never overwrite existing data
      const update: Record<string, string> = {};
      if (data.phone    && !contact.phone)    update.phone    = data.phone;
      if (data.whatsapp && !contact.whatsapp) update.whatsapp = data.whatsapp;
      if (data.name     && !contact.name)     update.name     = data.name;
      if (Object.keys(update).length > 0) {
        await db.contact.update({ where: { id: contact.id }, data: update });
      }
    }

    if (contact.flywheelProfile) {
      // Only upgrade status if still at earliest stage
      if (contact.flywheelProfile.leadStatus === 'NEW') {
        await db.flywheelProfile.update({
          where: { id: contact.flywheelProfile.id },
          data: {
            metadata: {
              ...(contact.flywheelProfile.metadata as object ?? {}),
              checkoutTier: data.tier || undefined,
              checkoutStartedAt: new Date().toISOString(),
              source: 'checkout_otp_verified',
            },
          },
        });
      }
    } else {
      await db.flywheelProfile.create({
        data: {
          contactId:     contact.id,
          leadStatus:    'NEW',
          lifecycleStage:'LEAD',
          optInSource:   'checkout',
          metadata: {
            checkoutTier: data.tier || undefined,
            checkoutStartedAt: new Date().toISOString(),
            source: 'checkout_otp_verified',
          },
        },
      });
    }

    await db.sysEmailLog.create({
      data: {
        to:      data.email,
        subject: 'Checkout OTP verified',
        trigger: 'CHECKOUT_OTP',
        channel: 'resend',
        status:  'sent',
        metadata: {
          event:   'otp_verified',
          tier:    data.tier,
          country: data.countryCode,
          source:  'checkout',
        },
      },
    });
  } catch (err) {
    console.error('[verify-otp] lead capture failed:', err);
  }
}
