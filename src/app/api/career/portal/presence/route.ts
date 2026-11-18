export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';
import { getCatalystTeamTimeZone } from '@/lib/career/presence';

export async function POST() {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const lastActiveAt = new Date();
    const client = await db.careerClient.update({
      where: { id: payload.clientId },
      // Clients can update presence only; the admin controls the saved time zone.
      data: { lastActiveAt },
      select: { lastActiveAt: true, timezone: true, contact: { select: { country: true, timezone: true } } },
    });
    const [admins, account, lastAccountView] = await Promise.all([
      db.adminUser.findMany({
        where: { isActive: true, brandAccess: { has: 'catalyst' }, lastActiveAt: { not: null } },
        orderBy: { lastActiveAt: 'desc' }, take: 1, select: { lastActiveAt: true },
      }),
      db.careerClient.findUnique({ where: { id: payload.clientId }, select: { lastViewedByAdminAt: true } }),
      db.careerActivityLog.findFirst({
        where: { clientId: payload.clientId, action: 'client_account_viewed' },
        orderBy: { createdAt: 'desc' },
        select: { performedBy: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({
      timezone: client.timezone || client.contact?.timezone || null,
      country: client.contact?.country || null,
      clientLastActiveAt: client.lastActiveAt,
      teamLastActiveAt: admins[0]?.lastActiveAt ?? null,
      teamTimezone: getCatalystTeamTimeZone(),
      lastViewedByAdminAt: lastAccountView?.createdAt ?? account?.lastViewedByAdminAt ?? null,
      lastViewedByAdminName: lastAccountView?.performedBy ?? null,
      serverNow: new Date().toISOString(),
      presenceAvailable: true,
    });
  } catch (error) {
    console.error('[portal-presence] Failed to record activity:', error);
    return NextResponse.json({ error: 'Collaboration status is temporarily unavailable.' }, { status: 503 });
  }
}
