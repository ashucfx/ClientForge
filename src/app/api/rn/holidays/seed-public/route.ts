// src/app/api/rn/holidays/seed-public/route.ts
// POST — seed Indian government public holidays for a given year
// Uses the free Nager.Date API: https://date.nager.at/api/v3/PublicHolidays/{year}/IN

import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NagerHoliday {
  date: string;       // "YYYY-MM-DD"
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export async function POST(req: Request) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const year = Number(body?.year ?? new Date().getFullYear());
  if (isNaN(year) || year < 2020 || year > 2030) {
    return NextResponse.json({ error: 'Invalid year. Must be between 2020 and 2030.' }, { status: 400 });
  }

  // Nager.Date API does not reliably support India (returns empty).
  // Provide a curated list of major Indian public holidays instead.
  const fixedHolidays = [
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-05-01`, name: 'Labour Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
    { date: `${year}-12-25`, name: 'Christmas Day' },
  ];

  const movableHolidays2026 = [
    { date: `2026-03-03`, name: 'Holi' },
    { date: `2026-03-20`, name: 'Eid-ul-Fitr' },
    { date: `2026-11-08`, name: 'Diwali' },
  ];

  let holidays = [...fixedHolidays];
  if (year === 2026) {
    holidays = [...holidays, ...movableHolidays2026];
  }

  let created = 0, skipped = 0;
  for (const h of holidays) {
    const date = new Date(`${h.date}T00:00:00.000Z`);
    try {
      await db.rnHoliday.upsert({
        where: { date },
        update: {
          name: h.name.slice(0, 120),
          isPublicHoliday: true,
          isGuested: true,
        },
        create: {
          date,
          name: h.name.slice(0, 120),
          description: null,
          isPublicHoliday: true,
          isGuested: true,
          createdById: session.adminId,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    message: `Seeded ${created} Indian public holidays for ${year}. ${skipped > 0 ? `${skipped} skipped (conflicts).` : ''}`,
    created,
    skipped,
    year,
  });
}
