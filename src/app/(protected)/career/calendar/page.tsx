'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';

interface Holiday {
  id: string;
  date: string;      // 'YYYY-MM-DD'
  name: string;
  description: string | null;
  isStatic: boolean;
  notifiedAt: string | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function toKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function HolidayCalendarPage() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [holidays,   setHolidays]   = useState<Holiday[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [notifying,  setNotifying]  = useState<string | null>(null); // holiday id being notified
  const [notifyMsg,  setNotifyMsg]  = useState('');
  const [form, setForm] = useState({ date: '', name: '', description: '' });
  const [saving, setSaving]   = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/holidays');
    if (res.ok) {
      const d = await res.json();
      setHolidays(d.holidays);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const holidayMap = new Map(holidays.map(h => [h.date, h]));

  // Calendar grid for current month
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const addHoliday = async () => {
    if (!form.date || !form.name) return;
    setSaving(true);
    const res = await fetch('/api/admin/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ date: '', name: '', description: '' });
      setAdding(false);
      setFeedback('Holiday added.');
      await load();
    } else {
      const d = await res.json();
      setFeedback(d.error ?? 'Failed to add holiday.');
    }
    setTimeout(() => setFeedback(''), 4000);
  };

  const removeHoliday = async (id: string) => {
    if (!confirm('Remove this holiday?')) return;
    await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
    setFeedback('Holiday removed.');
    setTimeout(() => setFeedback(''), 3000);
    await load();
  };

  const sendNotification = async (h: Holiday) => {
    const res = await fetch('/api/admin/holidays/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidayId: h.isStatic ? undefined : h.id, date: h.date, name: h.name, message: notifyMsg }),
    });
    const d = await res.json();
    setNotifying(null);
    setNotifyMsg('');
    if (res.ok) {
      setFeedback(`Notified ${d.sent} clients (${d.failed} failed).`);
      await load();
    } else {
      setFeedback(d.error ?? 'Notification failed.');
    }
    setTimeout(() => setFeedback(''), 5000);
  };

  const upcomingHolidays = holidays
    .filter(h => h.date >= today.toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Holiday Calendar</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage public holidays and custom off-days. These are excluded from SLA working-day calculations and can be notified to all active clients.
            </p>
          </div>
          <button
            onClick={() => { setAdding(true); setForm({ date: '', name: '', description: '' }); }}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-[#B8935B] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#9A7540] transition-colors"
          >
            + Add Holiday
          </button>
        </div>

        {feedback && (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
            {feedback}
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div className="border border-[#E8DDD0] rounded-2xl p-5 bg-[#FBF8F3] space-y-4">
            <p className="font-semibold text-slate-800">Add a Holiday</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B8935B]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Holiday Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dussehra"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B8935B]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Office closed"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B8935B]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={addHoliday}
                disabled={saving || !form.date || !form.name}
                className="bg-slate-900 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Holiday'}
              </button>
              <button onClick={() => setAdding(false)} className="text-sm text-slate-400 hover:text-slate-700 px-3 py-2">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Month nav */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <button onClick={prevMonth} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-lg">‹</button>
                <p className="font-bold text-slate-800">{MONTHS[month]} {year}</p>
                <button onClick={nextMonth} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-lg">›</button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {DAYS.map(d => (
                  <div key={d} className={`py-2 text-center text-[10px] font-bold uppercase tracking-wide ${d === 'Sun' || d === 'Sat' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-r border-b border-slate-50 min-h-[56px]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day  = i + 1;
                  const key  = toKey(year, month, day);
                  const h    = holidayMap.get(key);
                  const isToday = key === today.toISOString().slice(0, 10);
                  const dow  = new Date(year, month, day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div key={day} className={`border-r border-b border-slate-50 min-h-[56px] p-1.5 relative ${
                      isWeekend ? 'bg-slate-50/60' : ''
                    } ${h ? (h.isStatic ? 'bg-amber-50' : 'bg-rose-50') : ''}`}>
                      <span className={`text-xs font-semibold leading-none block mb-1 ${
                        isToday ? 'w-5 h-5 bg-[#B8935B] text-white rounded-full flex items-center justify-center text-[10px]' :
                        isWeekend ? 'text-slate-300' : 'text-slate-600'
                      }`}>{day}</span>
                      {h && (
                        <span className={`text-[9px] font-semibold leading-tight block truncate ${h.isStatic ? 'text-amber-700' : 'text-rose-700'}`}>
                          {h.name}
                        </span>
                      )}
                      {isWeekend && !h && (
                        <span className="text-[9px] text-slate-300 leading-tight block">
                          {dow === 6 ? 'Sat' : 'Sun'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-5 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />Indian public holiday</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" />Custom / office holiday</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />Weekend (no SLA)</span>
              </div>
            </div>
          </div>

          {/* Upcoming holidays list */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Upcoming Holidays</p>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : upcomingHolidays.length === 0 ? (
              <p className="text-sm text-slate-400">No upcoming holidays.</p>
            ) : (
              <div className="space-y-2">
                {upcomingHolidays.map(h => (
                  <div key={h.id} className={`rounded-xl p-3 border text-sm ${h.isStatic ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-xs truncate">{h.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {h.description && <p className="text-[10px] text-slate-400 mt-0.5 italic">{h.description}</p>}
                        {h.notifiedAt && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
                            ✓ Notified {new Date(h.notifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setNotifying(h.id); setNotifyMsg(''); }}
                          className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded-lg font-semibold hover:bg-slate-700 whitespace-nowrap"
                        >
                          Notify clients
                        </button>
                        {!h.isStatic && (
                          <button
                            onClick={() => removeHoliday(h.id)}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold text-center"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notify modal inline */}
                    {notifying === h.id && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-[10px] font-bold text-slate-600">Custom message (optional)</p>
                        <textarea
                          rows={3}
                          placeholder="Add any additional context for clients…"
                          value={notifyMsg}
                          onChange={e => setNotifyMsg(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#B8935B] resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => sendNotification(h)}
                            className="text-[10px] bg-[#B8935B] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#9A7540] transition-colors"
                          >
                            Send to all active clients
                          </button>
                          <button
                            onClick={() => { setNotifying(null); setNotifyMsg(''); }}
                            className="text-[10px] text-slate-400 hover:text-slate-700 px-2 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* All holidays table */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">All Holidays ({holidays.length})</p>
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Date', 'Holiday', 'Type', 'Notes', 'Clients Notified', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">Loading…</td></tr>
                ) : holidays.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">No holidays configured.</td></tr>
                ) : (
                  holidays.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{h.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          h.isStatic ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {h.isStatic ? 'National' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{h.description ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {h.notifiedAt ? (
                          <span className="text-emerald-600 font-semibold">
                            ✓ {new Date(h.notifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span className="text-slate-300">Not sent</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setNotifying(h.id); setNotifyMsg(''); }}
                          className="text-[10px] text-slate-500 hover:text-[#B8935B] font-semibold"
                        >
                          Notify
                        </button>
                        {!h.isStatic && (
                          <button onClick={() => removeHoliday(h.id)} className="ml-3 text-[10px] text-rose-400 hover:text-rose-600 font-semibold">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notify modal for table row */}
        {notifying && !upcomingHolidays.some(h => h.id === notifying) && (() => {
          const h = holidays.find(hh => hh.id === notifying);
          if (!h) return null;
          return (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => { setNotifying(null); setNotifyMsg(''); }}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <p className="font-bold text-slate-800 mb-1">Notify clients — {h.name}</p>
                <p className="text-xs text-slate-400 mb-4">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <textarea
                  rows={4}
                  placeholder="Optional: add a custom message for clients…"
                  value={notifyMsg}
                  onChange={e => setNotifyMsg(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B8935B] resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => sendNotification(h)}
                    className="flex-1 bg-[#B8935B] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#9A7540] transition-colors"
                  >
                    Send to all active clients
                  </button>
                  <button onClick={() => { setNotifying(null); setNotifyMsg(''); }} className="px-4 py-2.5 text-sm text-slate-400 hover:text-slate-700 rounded-xl border border-slate-200">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </AppShell>
  );
}
