// Working days utility — excludes weekends (Sat/Sun), Indian public holidays, and admin-defined holidays.

/** Static Indian public holidays (2025–2026). Merged with DB holidays at runtime. */
export const STATIC_HOLIDAYS = new Set<string>([
  // 2025 — Indian national + major gazetted holidays
  '2025-01-26', // Republic Day
  '2025-03-14', // Holi
  '2025-03-31', // Eid al-Fitr (approx)
  '2025-04-10', // Ram Navami (approx)
  '2025-04-14', // Dr. Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day / May Day
  '2025-08-15', // Independence Day
  '2025-08-16', // Janmashtami (approx)
  '2025-10-02', // Gandhi Jayanti / Dussehra (approx)
  '2025-10-20', // Diwali (approx)
  '2025-10-21', // Diwali (approx, second day)
  '2025-11-05', // Guru Nanak Jayanti (approx)
  '2025-12-25', // Christmas Day
  // 2026 — Indian national + major gazetted holidays
  '2026-01-26', // Republic Day
  '2026-03-04', // Holi (approx)
  '2026-03-20', // Eid al-Fitr (approx)
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day / May Day
  '2026-08-15', // Independence Day
  '2026-09-03', // Janmashtami (approx)
  '2026-10-02', // Gandhi Jayanti
  '2026-11-08', // Diwali (approx)
  '2026-11-09', // Diwali (approx, second day)
  '2026-11-24', // Guru Nanak Jayanti (approx)
  '2026-12-25', // Christmas Day
]);

/** Loads DB holidays and merges with static holidays. Call once per request on the server. */
export async function getHolidaySet(db: { holiday: { findMany: (args: any) => Promise<Array<{ date: Date }>> } }): Promise<Set<string>> {
  const dbHolidays = await db.holiday.findMany({
    where: { date: { gte: new Date('2025-01-01') } },
    select: { date: true },
  });
  const merged = new Set(STATIC_HOLIDAYS);
  for (const h of dbHolidays) {
    // Store DB holiday as IST date string
    const utcMs = h.date.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(utcMs);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const day = String(ist.getUTCDate()).padStart(2, '0');
    merged.add(`${y}-${m}-${day}`);
  }
  return merged;
}

function toDateKey(d: Date): string {
  // Use local IST-friendly key via UTC offset
  const utcMs = d.getTime() + 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
  const ist = new Date(utcMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWorkingDay(d: Date, holidays: Set<string> = STATIC_HOLIDAYS): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // Sun, Sat
  return !holidays.has(toDateKey(d));
}

/** Adds N working days (Mon–Fri, excluding holidays) to a date. Pass a merged holiday set for DB holidays. */
export function addWorkingDays(from: Date, days: number, holidays: Set<string> = STATIC_HOLIDAYS): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d, holidays)) added++;
  }
  return d;
}

/** Counts working days between two dates (exclusive of start, inclusive of end). */
export function countWorkingDays(start: Date, end: Date, holidays: Set<string> = STATIC_HOLIDAYS): number {
  const d = new Date(start);
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d, holidays)) count++;
  }
  return count;
}

/** Working days SLA per service. LinkedIn = 7 as confirmed. */
export const SERVICE_SLA_DAYS: Record<string, number> = {
  LINKEDIN:     7,
  RESUME:       5,
  COVER_LETTER: 3,
  PORTFOLIO:    10,
  FULL_PACKAGE: 7,
  PREMIUM_PLUS: 10,
};

/** Returns the maximum SLA days across all service slugs for a client. */
export function slaForSlugs(slugs: string[]): number {
  if (slugs.length === 0) return 5;
  return slugs.reduce((max, s) => Math.max(max, SERVICE_SLA_DAYS[s] ?? 5), 0);
}
