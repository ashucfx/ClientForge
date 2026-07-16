// src/app/api/rn/holidays/route.ts
// GET  — list RN agency holidays (upcoming first)
// POST — add/update a holiday; optional notify=true emails all active clients

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const holidays = await db.rnHoliday.findMany({ orderBy: { date: 'asc' } });
  return NextResponse.json({ holidays });
}

export async function POST(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const dateStr = (body?.date ?? '').toString();
  const name = (body?.name ?? '').toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !name) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) and name are required' }, { status: 400 });
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const holiday = await db.rnHoliday.upsert({
    where: { date },
    update: { name: name.slice(0, 120), description: body?.description?.slice(0, 500) ?? null },
    create: {
      date,
      name: name.slice(0, 120),
      description: body?.description?.slice(0, 500) ?? null,
      createdById: session.adminId,
    },
  });

  // Optional: notify every active client about the closure (branded SMTP email)
  if (body?.notify === true) {
    const clients = await db.rnClient.findMany({
      where: { lifecycleStatus: 'ACTIVE' },
      select: { id: true, name: true, email: true, magicToken: true },
    });
    const { sendRnEmail, rnEmailShell } = await import('@/lib/rn/mailer');
    const pretty = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

    for (const c of clients) {
      await sendRnEmail({
        clientId: c.id,
        to: c.email,
        subject: `Ripple Nexus office closure — ${pretty}`,
        trigger: 'holiday_notice',
        sentBy: session.adminId,
        html: rnEmailShell(
          'Upcoming office closure',
          `<p>Hi ${c.name},</p>
           <p>Our team will be offline on <strong>${pretty}</strong> for <strong>${holiday.name}</strong>${holiday.description ? ` — ${holiday.description}` : ''}.</p>
           <p>Replies and deliveries scheduled around that date may shift by one working day. Your project timeline is unaffected otherwise.</p>`,
        ),
        metadata: { holidayId: holiday.id },
      });
    }
    await db.rnHoliday.update({ where: { id: holiday.id }, data: { notifiedAt: new Date() } });
  }

  return NextResponse.json({ holiday }, { status: 201 });
}
