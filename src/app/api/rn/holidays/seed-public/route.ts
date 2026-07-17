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

  // Fetch from Nager.Date (free, no API key needed)
  let holidays: NagerHoliday[];
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`, {
      next: { revalidate: 86400 }, // cache for 24h
    });
    if (!res.ok) throw new Error(`Nager API returned ${res.status}`);
    holidays = await res.json();
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to fetch Indian public holidays from external API. Please try again later.',
      detail: String(err),
    }, { status: 502 });
  }

  // Filter to global Indian holidays only (no region-specific ones)
  const globalHolidays = holidays.filter(h => h.global === true);

  let created = 0, skipped = 0;
  for (const h of globalHolidays) {
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
          description: h.localName !== h.name ? h.localName : null,
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
