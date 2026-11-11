export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const timezone = typeof body?.timezone === 'string' ? body.timezone : undefined;
  if (timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
    catch { return NextResponse.json({ error: 'Invalid IANA time zone.' }, { status: 400 }); }
  }
  const now = new Date();
  const [client] = await Promise.all([
    db.careerClient.update({ where: { id: params.id }, data: { lastViewedByAdminAt: now, ...(timezone ? { timezone } : {}) }, select: { id: true } }),
    db.adminUser.update({ where: { id: session.adminId }, data: { lastActiveAt: now } }),
  ]);
  return NextResponse.json({ ok: Boolean(client) });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db.careerClient.update({ where: { id: params.id }, data: { lastViewedByAdminAt: new Date() }, select: { id: true } });
  const [client, activeTeam, thisAdmin] = await Promise.all([
    db.careerClient.findUnique({ where: { id: params.id }, select: { lastActiveAt: true, lastLoginAt: true, lastViewedByAdminAt: true, timezone: true, contact: { select: { country: true, timezone: true } } } }),
    db.adminUser.findFirst({ where: { isActive: true, brandAccess: { has: 'catalyst' }, lastActiveAt: { not: null } }, orderBy: { lastActiveAt: 'desc' }, select: { lastActiveAt: true } }),
    db.adminUser.update({ where: { id: session.adminId }, data: { lastActiveAt: new Date() }, select: { lastActiveAt: true } }),
  ]);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    clientLastActiveAt: client.lastActiveAt ?? client.lastLoginAt,
    teamLastActiveAt: activeTeam?.lastActiveAt ?? null,
    lastViewedByAdminAt: client.lastViewedByAdminAt,
    timezone: client.timezone || client.contact?.timezone || null,
    country: client.contact?.country || null,
    adminLastActiveAt: thisAdmin.lastActiveAt,
  });
}
