export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma as db } from '@/lib/db';
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/career/auth';

function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}

export async function POST(req: NextRequest) {
  const token = cookies().get(PORTAL_COOKIE)?.value ?? '';
  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const timezone = validTimezone(body?.timezone) ? body.timezone : undefined;
  const client = await db.careerClient.update({
    where: { id: payload.clientId },
    data: { lastActiveAt: new Date(), ...(timezone ? { timezone } : {}) },
    select: { timezone: true, contact: { select: { country: true, timezone: true } } },
  });
  const admins = await db.adminUser.findMany({
    where: { isActive: true, brandAccess: { has: 'catalyst' } },
    orderBy: { lastActiveAt: 'desc' }, take: 1, select: { lastActiveAt: true },
  });
  const account = await db.careerClient.findUnique({ where: { id: payload.clientId }, select: { lastViewedByAdminAt: true } });
  return NextResponse.json({
    timezone: client.timezone || client.contact?.timezone || null,
    country: client.contact?.country || null,
    teamLastActiveAt: admins[0]?.lastActiveAt ?? null,
    lastViewedByAdminAt: account?.lastViewedByAdminAt ?? null,
  });
}
