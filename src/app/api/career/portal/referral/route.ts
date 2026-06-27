// src/app/api/career/portal/referral/route.ts
// Career portal: client retrieves their referral code and stats.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { ensureReferralCode, getReferralStats } from '@/lib/referral';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';

export async function GET(req: NextRequest) {
  void req;
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db.careerClient.findUnique({
    where: { id: payload.clientId },
    select: { id: true, name: true, contactId: true },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Locate or create FlywheelProfile via contact
  let profile = null;
  if (client.contactId) {
    profile = await db.flywheelProfile.findUnique({
      where: { contactId: client.contactId },
      select: { id: true, referralCode: true },
    });
  }
  if (!profile) {
    return NextResponse.json({
      referralCode: null,
      referralLink: null,
      stats: { count: 0, convertedCount: 0, totalRevenue: 0, referrals: [] },
    });
  }

  const referralCode = await ensureReferralCode(profile.id);
  // Link goes directly to /checkout so the ?ref param is captured by the form
  const referralLink = `${APP_URL}/checkout?ref=${referralCode}`;
  const stats = await getReferralStats(profile.id);

  return NextResponse.json({
    referralCode,
    referralLink,
    stats: {
      count: stats.referrals.length,
      convertedCount: stats.convertedCount,
      totalRevenue: stats.totalRevenue,
      referrals: stats.referrals.map((r) => ({
        name: r.contact.name,
        joinedAt: r.contact.createdAt,
        isConverted: r.lifecycleStage === 'CUSTOMER',
      })),
    },
  });
}
