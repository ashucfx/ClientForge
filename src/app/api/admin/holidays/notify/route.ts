export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { sendCareerEmail } from '@/lib/career/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://catalyst.theripplenexus.com';

// Eligible recipients = active clients not yet completed. Shared by GET (preview
// the list so the admin can choose) and POST (the actual send).
const ELIGIBLE_WHERE: Prisma.CareerClientWhereInput = {
  lifecycleStatus: 'ACTIVE',
  status: { notIn: ['COMPLETED'] },
};

// GET — list who a holiday notice WOULD go to, so the admin can review/select.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await db.careerClient.findMany({
    where: ELIGIBLE_WHERE,
    select: { id: true, name: true, email: true, status: true, packageType: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ clients, total: clients.length });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  // body: { holidayId?: string, date: string, name: string, message?: string, clientIds?: string[] }
  if (!body?.date || !body?.name) {
    return NextResponse.json({ error: 'date and name required' }, { status: 400 });
  }

  // When clientIds is provided and non-empty, send ONLY to those (still constrained
  // to eligible clients). Absent/empty => send to all eligible (backward compatible).
  const selectedIds: string[] | undefined =
    Array.isArray(body.clientIds) && body.clientIds.length > 0
      ? body.clientIds.map(String)
      : undefined;

  const holidayDate = new Date(body.date + 'T00:00:00.000Z');
  const formattedDate = holidayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const customMsg = body.message ? String(body.message).trim() : '';

  // Fetch eligible clients (optionally narrowed to the admin's selection)
  const clients = await db.careerClient.findMany({
    where: {
      ...ELIGIBLE_WHERE,
      ...(selectedIds ? { id: { in: selectedIds } } : {}),
    },
    select: { id: true, name: true, email: true },
  });

  let sent = 0;
  let failed = 0;

  for (const client of clients) {
    const bodyText = [
      `We wanted to let you know that our team will be observing **${body.name}** on **${formattedDate}**.`,
      '',
      customMsg || 'Our offices will be closed on this day. Please note this may slightly affect response times. We will still be working on deliverables and will reach out to you as soon as possible.',
      '',
      'If your delivery date falls near this holiday, rest assured it has already been accounted for in our working-day SLA calculation.',
      '',
      'You can view your expected delivery date anytime in your portal.',
    ].join('\n');

    const result = await sendCareerEmail({
      to: client.email,
      trigger: 'MESSAGE_NOTIFY',
      data: {
        recipientName: client.name,
        senderType: 'admin',
        subject: `Catalyst — Upcoming holiday notice: ${body.name} (${formattedDate})`,
        portalUrl: `${APP_URL}/portal/dashboard`,
        body: bodyText,
      },
    }).then(() => 'sent').catch(() => 'failed');

    if (result === 'sent') {
      sent++;
      await db.sysEmailLog.create({
        data: {
          to: client.email,
          subject: `Catalyst — Upcoming holiday notice: ${body.name}`,
          trigger: 'HOLIDAY_NOTICE',
          channel: 'resend',
          status: 'sent',
          metadata: { clientId: client.id, holidayDate: body.date, holidayName: body.name },
        },
      }).catch(() => {});
    } else {
      failed++;
    }
  }

  // Mark holiday as notified
  if (body.holidayId) {
    await db.holiday.update({
      where: { id: body.holidayId },
      data: { notifiedAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sent, failed, total: clients.length });
}
