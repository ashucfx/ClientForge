export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

export async function POST() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const client = await db.careerClient.update({
      where: { id: payload.clientId },
      // Clients can update presence only; the admin controls the saved time zone.
      data: { lastActiveAt: new Date() },
      select: { timezone: true, contact: { select: { country: true, timezone: true } } },
    });
    const [admins, account] = await Promise.all([
      db.adminUser.findMany({
        where: { isActive: true, brandAccess: { has: 'catalyst' } },
        orderBy: { lastActiveAt: 'desc' }, take: 1, select: { lastActiveAt: true },
      }),
      db.careerClient.findUnique({ where: { id: payload.clientId }, select: { lastViewedByAdminAt: true } }),
    ]);
    return NextResponse.json({
      timezone: client.timezone || client.contact?.timezone || null,
      country: client.contact?.country || null,
      teamLastActiveAt: admins[0]?.lastActiveAt ?? null,
      lastViewedByAdminAt: account?.lastViewedByAdminAt ?? null,
      presenceAvailable: true,
    });
  } catch (error) {
    console.error('[portal-presence] Failed to record activity:', error);
    return NextResponse.json({ error: 'Collaboration status is temporarily unavailable.' }, { status: 503 });
  }
}
