'use client';
// src/app/(protected)/bugs/page.tsx — Client Issue Diagnostics & Bug Reports

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { format } from 'date-fns';

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

const STATUS_CONFIG: Record<BugStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  OPEN:        { label: 'Open',        dot: 'bg-rose-500',    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  RESOLVED:    { label: 'Resolved',    dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CLOSED:      { label: 'Closed',      dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200' },
};

const ALL_STATUSES: BugStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function BugsPage() {
  const [bugs, setBugs]                 = useState<BugReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<BugStatus | 'ALL'>('ALL');
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [viewImg, setViewImg]           = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bug-report/list');
      if (res.ok) {
        const data = (await res.json()) as { bugs: BugReport[] };
        setBugs(data.bugs ?? []);
      }
    } catch (err) {
      console.error('Failed to load bug reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateBug = async (id: string, patch: { status?: BugStatus; adminNotes?: string }) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/bug-report/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const { bugReport } = (await res.json()) as { bugReport: BugReport };
        setBugs(prev => prev.map(b => (b.id === id ? bugReport : b)));
        if (patch.adminNotes !== undefined) {
          setEditingNotes(prev => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
        }
      }
    } catch (err) {
      console.error('Failed to update bug report:', err);
    } finally {
      setSavingId(null);
    }
  };

  const deleteBug = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/bug-report/${id}`, { method: 'DELETE' });
      if (res.ok) setBugs(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Failed to delete bug report:', err);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
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
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">
        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Platform Diagnostics</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center shadow-xs">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Client Bug Reports</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live issues and feedback reported by clients across their career portals.
            </p>
          </div>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={loading ? 'animate-spin text-[#B8935B]' : ''}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Reports</span>
          </button>
        </div>

        {/* ── Metric Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {ALL_STATUSES.map(s => {
            const m = STATUS_CONFIG[s];
            const isSelected = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? 'ALL' : s)}
                className={`text-left p-4 rounded-2xl border transition-all shadow-xs ${
                  isSelected
                    ? `${m.bg} ${m.border} ring-1 ring-current`
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? m.text : 'text-slate-400'}`}>
                    {m.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                </div>
                <div className={`text-2xl font-extrabold mt-1 ${isSelected ? m.text : 'text-slate-900'}`}>
                  {counts[s]}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['ALL', ...ALL_STATUSES] as const).map(s => {
            const isSelected = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#B8935B] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{s === 'ALL' ? 'All Reports' : STATUS_CONFIG[s].label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Bug Reports List ── */}
        {loading ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs shadow-xs">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="animate-spin text-[#B8935B] mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Loading diagnostic reports…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FBF8F3] border border-[#EAE2D5] text-[#B8935B] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="font-bold text-slate-700 text-sm">No bug reports in this category</div>
            <div className="text-slate-400 mt-1">All issues have been resolved or no reports have been filed.</div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {visible.map(bug => {
              const isExpanded = expanded === bug.id;
              const meta = STATUS_CONFIG[bug.status];
              const notesDraft = editingNotes[bug.id] !== undefined ? editingNotes[bug.id] : (bug.adminNotes ?? '');
              const notesChanged = editingNotes[bug.id] !== undefined && editingNotes[bug.id] !== (bug.adminNotes ?? '');

              return (
                <div
                  key={bug.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => setExpanded(isExpanded ? null : bug.id)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {bug.clientName || 'Anonymous Client'}
                        </span>
                        {bug.clientEmail && (
                          <span className="text-xs text-slate-400 font-mono">({bug.clientEmail})</span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          · {format(new Date(bug.createdAt), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 font-medium line-clamp-2 mt-1">
                        {bug.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                      <select
                        value={bug.status}
                        onChange={e => updateBug(bug.id, { status: e.target.value as BugStatus })}
                        disabled={savingId === bug.id}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#B8935B]"
                      >
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : bug.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 sm:p-6 bg-slate-50/60 space-y-4">
                      {bug.url && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Origin URL
                          </div>
                          <a
                            href={bug.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#B8935B] hover:underline font-mono break-all"
                          >
                            {bug.url}
                          </a>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Full Issue Description
                        </div>
                        <div className="text-xs sm:text-sm text-slate-800 bg-white p-3.5 rounded-xl border border-slate-200/80 whitespace-pre-wrap leading-relaxed">
                          {bug.description}
                        </div>
                      </div>

                      {bug.screenshotUrl && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Attached Screenshot
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewImg(bug.screenshotUrl)}
                            className="block rounded-xl overflow-hidden border border-slate-200 hover:opacity-95 transition-opacity"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={bug.screenshotUrl}
                              alt="Bug screenshot"
                              className="max-h-48 object-cover cursor-zoom-in"
                            />
                          </button>
                        </div>
                      )}

                      {/* Admin Notes */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Admin Resolution Notes
                        </div>
                        <textarea
                          rows={3}
                          value={notesDraft}
                          onChange={e => setEditingNotes(prev => ({ ...prev, [bug.id]: e.target.value }))}
                          placeholder="Add root cause, resolution status, or internal developer notes…"
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#B8935B] focus:ring-2 focus:ring-[#B8935B]/20 resize-none"
                        />
                        {notesChanged && (
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[bug.id]; return n; })}
                              className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => updateBug(bug.id, { adminNotes: notesDraft })}
                              disabled={savingId === bug.id}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#B8935B] hover:bg-[#9A7540] rounded-lg shadow-xs transition-colors"
                            >
                              {savingId === bug.id ? 'Saving…' : 'Save Notes'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete Report Option */}
                      <div className="pt-3 border-t border-slate-200/70 flex items-center justify-end gap-2">
                        {deleteConfirmId === bug.id ? (
                          <>
                            <span className="text-xs text-rose-600 font-semibold">Confirm delete?</span>
                            <button
                              onClick={() => deleteBug(bug.id)}
                              disabled={deletingId === bug.id}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                            >
                              {deletingId === bug.id ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(bug.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete Report</span>
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

        {/* Screenshot Modal Lightbox */}
        {viewImg && (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setViewImg(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewImg}
              alt="Bug screenshot zoomed"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setViewImg(null)}
              className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center font-bold text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
