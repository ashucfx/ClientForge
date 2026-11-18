export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { getAdminDisplayName } from '@/lib/career/presence';

async function recordAccountView(clientId: string, adminId: string) {
  const admin = await db.adminUser.findUnique({ where: { id: adminId }, select: { email: true } });
  const viewedAt = new Date();
  const viewerName = getAdminDisplayName(admin?.email);
  await db.$transaction([
    db.careerClient.update({
      where: { id: clientId },
      data: { lastViewedByAdminAt: viewedAt },
      select: { id: true },
    }),
    db.careerActivityLog.create({
      data: {
        clientId,
        action: 'client_account_viewed',
        performedBy: viewerName,
        metadata: { viewerId: adminId },
        createdAt: viewedAt,
      },
      select: { id: true },
    }),
  ]);
  return { viewedAt, viewerName };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const timezone = typeof body?.timezone === 'string' ? body.timezone : undefined;
  if (timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
    catch { return NextResponse.json({ error: 'Invalid IANA time zone.' }, { status: 400 }); }
  }
  if (!timezone) return NextResponse.json({ error: 'Choose a time zone before saving.' }, { status: 400 });
  try {
    await db.careerClient.update({ where: { id: params.id }, data: { timezone }, select: { id: true } });
    return NextResponse.json({ ok: true, timezone, presenceAvailable: true });
  } catch (error) {
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (req.nextUrl.searchParams.get('view') === '1') {
      await recordAccountView(params.id, session.adminId);
    }
    const [client, lastAccountView] = await Promise.all([
      db.careerClient.findUnique({ where: { id: params.id }, select: { lastActiveAt: true, lastLoginAt: true, lastViewedByAdminAt: true, timezone: true, contact: { select: { country: true, timezone: true } } } }),
      db.careerActivityLog.findFirst({ where: { clientId: params.id, action: 'client_account_viewed' }, orderBy: { createdAt: 'desc' }, select: { performedBy: true, createdAt: true } }),
    ]);
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      clientLastActiveAt: client.lastActiveAt,
      clientLastLoginAt: client.lastLoginAt,
      lastViewedByAdminAt: lastAccountView?.createdAt ?? client.lastViewedByAdminAt,
      lastViewedByAdminName: lastAccountView?.performedBy ?? null,
      timezone: client.timezone || client.contact?.timezone || null,
      country: client.contact?.country || null,
      serverNow: new Date().toISOString(),
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
        clientLastActiveAt: null,
        clientLastLoginAt: client.lastLoginAt,
        lastViewedByAdminAt: null,
        lastViewedByAdminName: null,
        timezone: client.contact?.timezone || null,
        country: client.contact?.country || null,
        serverNow: new Date().toISOString(),
        presenceAvailable: false,
      });
    } catch (fallbackError) {
      console.error('[client-presence] Fallback lookup failed:', fallbackError);
      return NextResponse.json({ error: 'Collaboration status is temporarily unavailable.' }, { status: 503 });
    }
  }
}
