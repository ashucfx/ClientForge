'use client';
// src/app/(protected)/bugs/page.tsx

import { useState, useEffect, useCallback } from 'react';

type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface BugReport {
  id: string;
  description: string;
  url: string | null;
  status: BugStatus;
  adminNotes: string | null;
  clientName: string | null;
  clientEmail: string | null;
  screenshotUrl: string | null;
  createdAt: string;
}

const STATUS_META: Record<BugStatus, { label: string; dot: string; bg: string; text: string }> = {
  OPEN:        { label: 'Open',        dot: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700'    },
  IN_PROGRESS: { label: 'In Progress', dot: '#f59e0b', bg: 'bg-amber-100',  text: 'text-amber-700'  },
  RESOLVED:    { label: 'Resolved',    dot: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700'},
  CLOSED:      { label: 'Closed',      dot: '#94a3b8', bg: 'bg-slate-100',  text: 'text-slate-500'  },
};

const ALL_STATUSES: BugStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function BugsPage() {
  const [bugs, setBugs]         = useState<BugReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<BugStatus | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewImg, setViewImg]   = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/bug-report/list');
    if (res.ok) {
      const data = await res.json() as { bugs: BugReport[] };
      setBugs(data.bugs ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateBug = async (id: string, patch: { status?: BugStatus; adminNotes?: string }) => {
    setSavingId(id);
    const res = await fetch(`/api/admin/bug-report/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const { bugReport } = await res.json() as { bugReport: BugReport };
      setBugs(prev => prev.map(b => b.id === id ? bugReport : b));
      if (patch.adminNotes !== undefined) {
        setEditingNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    }
    setSavingId(null);
  };

  const deleteBug = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/admin/bug-report/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    setDeleteConfirmId(null);
    if (res.ok) setBugs(prev => prev.filter(b => b.id !== id));
  };

  const counts: Record<BugStatus | 'ALL', number> = {
    ALL:         bugs.length,
    OPEN:        bugs.filter(b => b.status === 'OPEN').length,
    IN_PROGRESS: bugs.filter(b => b.status === 'IN_PROGRESS').length,
    RESOLVED:    bugs.filter(b => b.status === 'RESOLVED').length,
    CLOSED:      bugs.filter(b => b.status === 'CLOSED').length,
  };

  const visible = filter === 'ALL' ? bugs : bugs.filter(b => b.status === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span className="text-red-500">🐛</span> Bug Reports
        </h1>
        <p className="text-sm text-slate-500 mt-1">Issues reported by clients from the portal. Manage status and add resolution notes.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ALL_STATUSES.map(s => {
          const m = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? 'ALL' : s)}
              className={`text-left p-4 rounded-xl border transition-all ${
                filter === s
                  ? `${m.bg} border-current shadow-sm`
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className={`text-2xl font-bold ${filter === s ? m.text : 'text-slate-900'}`}>{counts[s]}</p>
              <p className={`text-xs font-semibold uppercase tracking-wide mt-0.5 ${filter === s ? m.text : 'text-slate-400'}`}>{m.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
        {(['ALL', ...ALL_STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filter === s
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_META[s].label}
            {' '}
            <span className={`ml-1 ${filter === s ? 'text-slate-500' : 'text-slate-400'}`}>({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-base font-semibold text-slate-700">
            {filter === 'ALL' ? 'No bug reports yet' : `No ${STATUS_META[filter].label.toLowerCase()} bugs`}
          </p>
          <p className="text-sm text-slate-400 mt-1">Everything looks clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(bug => {
            const m = STATUS_META[bug.status];
            const isExpanded = expanded === bug.id;
            const notesDraft = editingNotes[bug.id] ?? bug.adminNotes ?? '';
            const notesChanged = editingNotes[bug.id] !== undefined && editingNotes[bug.id] !== (bug.adminNotes ?? '');

            return (
              <div key={bug.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : bug.id)}
                >
                  {/* Dot indicator */}
                  <div className="mt-1.5 flex-shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: m.dot }} />
                  </div>

                  {/* Description + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">{bug.description}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${m.bg} ${m.text}`}>
                        {m.label}
                      </span>
                      {bug.clientName && (
                        <span className="text-xs text-slate-500">{bug.clientName} · {bug.clientEmail}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(bug.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {bug.adminNotes && (
                        <span className="text-xs text-amber-600 font-medium">📝 Note added</span>
                      )}
                      {bug.screenshotUrl && (
                        <span className="text-xs text-blue-500 font-medium">📎 Screenshot</span>
                      )}
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="flex-shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <select
                      value={bug.status}
                      onChange={e => updateBug(bug.id, { status: e.target.value as BugStatus })}
                      disabled={savingId === bug.id}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B] disabled:opacity-50"
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                    {savingId === bug.id && (
                      <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24"
                    >
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
                    {/* URL */}
                    {bug.url && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reported From</p>
                        <a href={bug.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline break-all">{bug.url}</a>
                      </div>
                    )}

                    {/* Full description */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Description</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{bug.description}</p>
                    </div>

                    {/* Screenshot */}
                    {bug.screenshotUrl && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Screenshot</p>
                        <button
                          onClick={() => setViewImg(bug.screenshotUrl)}
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={bug.screenshotUrl}
                            alt="Bug screenshot"
                            className="max-h-48 rounded-lg border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                          />
                        </button>
                      </div>
                    )}

                    {/* Admin notes */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Admin Notes</p>
                      <textarea
                        rows={3}
                        value={notesDraft}
                        onChange={e => setEditingNotes(prev => ({ ...prev, [bug.id]: e.target.value }))}
                        placeholder="Add resolution notes, workaround, or internal comments…"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#B8935B] resize-none"
                      />
                      {notesChanged && (
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[bug.id]; return n; })}
                            className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            Discard
                          </button>
                          <button
                            onClick={() => updateBug(bug.id, { adminNotes: notesDraft })}
                            disabled={savingId === bug.id}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                          >
                            {savingId === bug.id ? 'Saving…' : 'Save Notes'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      {deleteConfirmId === bug.id ? (
                        <>
                          <span className="text-xs text-red-600 font-medium">Delete this report?</span>
                          <button onClick={() => deleteBug(bug.id)} disabled={deletingId === bug.id}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                            {deletingId === bug.id ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(bug.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-slate-200 rounded-lg hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                          </svg>
                          Delete Report
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot lightbox */}
      {viewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewImg(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewImg}
            alt="Bug screenshot full view"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setViewImg(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
