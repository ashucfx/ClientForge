export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { STATIC_HOLIDAYS } from '@/lib/workingDays';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbHolidays = await db.holiday.findMany({
    orderBy: { date: 'asc' },
  });

  // Also expose static holidays so the calendar can display them
  const staticList = Array.from(STATIC_HOLIDAYS).map(d => ({
    id: `static:${d}`,
    date: d,
    name: STATIC_NAMES[d] ?? 'Public Holiday',
    description: 'Indian national / gazetted holiday',
    isStatic: true,
    notifiedAt: null,
  })).sort((a, b) => a.date.localeCompare(b.date));

  const dbList = dbHolidays.map(h => ({
    id: h.id,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    description: h.description ?? null,
    isStatic: false,
    notifiedAt: h.notifiedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ holidays: [...staticList, ...dbList] });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.date || !body?.name) {
    return NextResponse.json({ error: 'date and name are required' }, { status: 400 });
  }

  const date = new Date(body.date + 'T00:00:00.000Z'); // midnight UTC = DATE storage

  const holiday = await db.holiday.upsert({
    where: { date },
    create: {
      date,
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
      createdById: (session as any).id ?? null,
    },
    update: {
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
    },
  });

  await db.sysEmailLog.create({
    data: {
      to: 'system',
      subject: `Holiday added: ${body.name} on ${body.date}`,
      trigger: 'HOLIDAY_ADDED',
      channel: 'admin',
      status: 'sent',
      metadata: { date: body.date, name: body.name },
    },
  }).catch(() => {});

  return NextResponse.json({ holiday: { ...holiday, date: holiday.date.toISOString().slice(0, 10) } }, { status: 201 });
}

// Human-readable names for static holidays (mirrors workingDays.ts comments)
const STATIC_NAMES: Record<string, string> = {
  '2025-01-26': 'Republic Day',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Eid al-Fitr',
  '2025-04-10': 'Ram Navami',
  '2025-04-14': 'Dr. Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day / May Day',
  '2025-08-15': 'Independence Day',
  '2025-08-16': 'Janmashtami',
  '2025-10-02': 'Gandhi Jayanti / Dussehra',
  '2025-10-20': 'Diwali',
  '2025-10-21': 'Diwali (2nd day)',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas Day',
  '2026-01-26': 'Republic Day',
  '2026-03-04': 'Holi',
  '2026-03-20': 'Eid al-Fitr',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day / May Day',
  '2026-08-15': 'Independence Day',
  '2026-09-03': 'Janmashtami',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-11-08': 'Diwali',
  '2026-11-09': 'Diwali (2nd day)',
  '2026-11-24': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas Day',
};
