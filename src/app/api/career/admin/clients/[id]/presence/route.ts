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
  try {
    const [client] = await Promise.all([
      db.careerClient.update({ where: { id: params.id }, data: { lastViewedByAdminAt: now, ...(timezone ? { timezone } : {}) }, select: { id: true } }),
      db.adminUser.update({ where: { id: session.adminId }, data: { lastActiveAt: now } }),
    ]);
    return NextResponse.json({ ok: Boolean(client), timezone, presenceAvailable: true });
  } catch (error) {
    if (!timezone) {
      console.error('[client-presence] Failed to record admin activity:', error);
      return NextResponse.json({ error: 'Collaboration status is temporarily unavailable.' }, { status: 503 });
    }
    // Keep the selected time zone usable on deployments where the additive
    // CareerClient presence columns have not been applied yet.
    try {
      const client = await db.careerClient.findUnique({ where: { id: params.id }, select: { contactId: true } });
      if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!client.contactId) return NextResponse.json({ error: 'This client has no linked contact record to save the time zone.' }, { status: 409 });
      await db.contact.update({ where: { id: client.contactId }, data: { timezone } });
      return NextResponse.json({ ok: true, timezone, presenceAvailable: false });
    } catch (fallbackError) {
      console.error('[client-presence] Failed to save time zone fallback:', fallbackError);
      return NextResponse.json({ error: 'Could not save this time zone.' }, { status: 503 });
    }
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
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
      presenceAvailable: true,
    });
  } catch (error) {
    // Presence columns are additive and may not yet exist in older deployments.
    // Keep the client account usable and return the older login/country details.
    console.error('[client-presence] Presence fields unavailable:', error);
    try {
      const client = await db.careerClient.findUnique({
        where: { id: params.id },
        select: { lastLoginAt: true, contact: { select: { country: true, timezone: true } } },
      });
      if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({
        clientLastActiveAt: client.lastLoginAt,
        teamLastActiveAt: null,
        lastViewedByAdminAt: null,
        timezone: client.contact?.timezone || null,
        country: client.contact?.country || null,
        presenceAvailable: false,
      });
    } catch (fallbackError) {
      console.error('[client-presence] Fallback lookup failed:', fallbackError);
      return NextResponse.json({ error: 'Collaboration status is temporarily unavailable.' }, { status: 503 });
    }
  }
}
