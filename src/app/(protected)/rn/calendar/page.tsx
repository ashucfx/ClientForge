// src/app/(protected)/rn/calendar/page.tsx — Delivery Calendar v2
// Month view: deadlines + milestones + holidays (guested vs non-guested)
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { HolidayManager, DeleteHolidayButton } from '@/components/rn/HolidayManager';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { format, startOfMonth, endOfMonth, addMonths, differenceInCalendarDays } from 'date-fns';

export const dynamic = 'force-dynamic';

type CalEvent = {
  day: number;
  type: 'deadline' | 'milestone' | 'holiday_public' | 'holiday_custom' | 'holiday_internal';
  label: string;
  href?: string;
};

export default async function RnCalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && !session.brandAccess.includes('ripple_nexus'))) {
    redirect('/login');
  }

  const anchor = /^\d{4}-\d{2}$/.test(searchParams.m ?? '')
    ? new Date(`${searchParams.m}-01T00:00:00`)
    : new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd   = endOfMonth(anchor);
  const prevM = format(addMonths(monthStart, -1), 'yyyy-MM');
  const nextM = format(addMonths(monthStart,  1), 'yyyy-MM');

  const [clients, milestones, holidays, upcomingHolidays] = await Promise.all([
    prisma.rnClient.findMany({
      where: { lifecycleStatus: 'ACTIVE', expectedDeliveryAt: { gte: monthStart, lte: monthEnd } },
      select: { id: true, name: true, companyName: true, expectedDeliveryAt: true },
    }),
    prisma.rnProjectMilestone.findMany({
      where: { dueDate: { gte: monthStart, lte: monthEnd }, status: { notIn: ['COMPLETED', 'APPROVED'] } },
      include: { client: { select: { id: true, name: true, companyName: true } } },
    }),
    prisma.rnHoliday.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.rnHoliday.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 8,
    }),
  ]);

  // Bucket events by day
  const eventsByDay = new Map<number, CalEvent[]>();
  const push = (day: number, e: CalEvent) => {
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(e);
  };
  for (const c of clients) {
    push(new Date(c.expectedDeliveryAt!).getDate(), {
      day: 0, type: 'deadline', label: `${c.companyName || c.name} delivery`, href: `/rn/projects/${c.id}`,
    });
  }
  for (const m of milestones) {
    push(new Date(m.dueDate!).getDate(), {
      day: 0, type: 'milestone', label: `${m.title} · ${m.client.companyName || m.client.name}`, href: `/rn/projects/${m.client.id}/milestones`,
    });
  }
  for (const h of holidays) {
    const type: CalEvent['type'] = h.isPublicHoliday
      ? 'holiday_public'
      : h.isGuested ? 'holiday_custom' : 'holiday_internal';
    push(new Date(h.date).getUTCDate(), { day: 0, type, label: h.name + (h.isGuested ? '' : ' 🔒') });
  }

  const daysInMonth   = monthEnd.getDate();
  const firstWeekday  = monthStart.getDay();
  const today         = new Date();
  const isCurrentMonth = today.getFullYear() === monthStart.getFullYear() && today.getMonth() === monthStart.getMonth();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const DOT: Record<CalEvent['type'], string> = {
    deadline:         'var(--danger)',
    milestone:        'var(--plasma)',
    holiday_public:   'var(--lime)',
    holiday_custom:   'var(--cyan)',
    holiday_internal: 'var(--text-tertiary)',
  };

  return (
    <RippleNexusShell>
      <main className="rn-page">
        <header className="rn-page-header">
          <div>
            <div className="rn-eyebrow" style={{ marginBottom: 6 }}>Workspace</div>
            <h1 className="rn-title-xl">Delivery Calendar</h1>
            <p className="rn-subtitle" style={{ marginTop: 8 }}>
              Project deadlines, milestones, and agency holidays in one view.
            </p>
          </div>
          <HolidayManager />
        </header>

        <div className="rn-dash-grid">
          {/* Month grid */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">{format(monthStart, 'MMMM yyyy')}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/rn/calendar?m=${prevM}`} className="rn-chip">← {format(addMonths(monthStart, -1), 'MMM')}</Link>
                <Link href="/rn/calendar" className="rn-chip">Today</Link>
                <Link href={`/rn/calendar?m=${nextM}`} className="rn-chip">{format(addMonths(monthStart, 1), 'MMM')} →</Link>
              </div>
            </div>
            <div className="rn-panel-body" style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 0' }}>{d}</div>
                ))}
                {cells.map((day, i) => {
                  const events = day ? (eventsByDay.get(day) ?? []) : [];
                  const isToday = isCurrentMonth && day === today.getDate();
                  const hasHoliday = events.some(e => e.type.startsWith('holiday'));
                  return (
                    <div key={i} style={{
                      minHeight: 88, borderRadius: 12, padding: '6px 5px',
                      background: day ? (hasHoliday ? 'rgba(34,211,238,0.06)' : 'var(--surface-3)') : 'transparent',
                      border: day ? `1px solid ${isToday ? 'var(--brand)' : hasHoliday ? 'rgba(34,211,238,0.2)' : 'var(--border)'}` : '1px solid transparent',
                      boxShadow: isToday ? '0 0 0 2px var(--brand-faint)' : 'none',
                      transition: 'all 150ms var(--ease)',
                    }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--plasma)' : 'var(--text-tertiary)', marginBottom: 4, textAlign: 'right' }}>{day}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {events.slice(0, 3).map((e, j) => {
                              const inner = (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                  <span style={{ width: 5, height: 5, borderRadius: 3, background: DOT[e.type], flexShrink: 0 }} />
                                  {e.label}
                                </span>
                              );
                              return e.href
                                ? <Link key={j} href={e.href} style={{ textDecoration: 'none' }} title={e.label}>{inner}</Link>
                                : <span key={j} title={e.label}>{inner}</span>;
                            })}
                            {events.length > 3 && (
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>+{events.length - 3} more</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingLeft: 4, flexWrap: 'wrap' }}>
                {([
                  ['deadline',        'Project delivery'],
                  ['milestone',       'Milestone due'],
                  ['holiday_public',  'Public holiday (🇮🇳)'],
                  ['holiday_custom',  'Custom holiday (client-visible)'],
                  ['holiday_internal','Internal closure only'],
                ] as const).map(([t, lbl]) => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[t], flexShrink: 0 }} /> {lbl}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming holidays rail */}
          <div className="rn-panel">
            <div className="rn-panel-header">
              <h2 className="rn-panel-title">Agency Holidays</h2>
            </div>
            <div className="rn-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {upcomingHolidays.length === 0 ? (
                <div className="rn-empty" style={{ padding: '24px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🗓</div>
                  <p className="rn-empty-desc">No upcoming holidays. Use &ldquo;Seed Public Holidays&rdquo; to import Indian public holidays or add a custom one.</p>
                </div>
              ) : upcomingHolidays.map(h => {
                const days = differenceInCalendarDays(new Date(h.date), new Date());
                return (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--surface-3)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{h.name}</div>
                        {h.isPublicHoliday && <span className="rn-badge lime" style={{ fontSize: 10 }}>🇮🇳 Public</span>}
                        {!h.isGuested && <span className="rn-badge neutral" style={{ fontSize: 10 }}>🔒 Internal</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {format(new Date(h.date), 'EEE, MMM d, yyyy')}
                        {h.notifiedAt && <span style={{ color: 'var(--success)', marginLeft: 8, fontWeight: 600 }}>· clients notified</span>}
                      </div>
                      {h.description && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{h.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span className={`rn-badge ${days <= 3 ? 'warning' : days <= 7 ? 'cyan' : 'neutral'}`}>
                        {days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                      <DeleteHolidayButton id={h.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </RippleNexusShell>
  );
}
