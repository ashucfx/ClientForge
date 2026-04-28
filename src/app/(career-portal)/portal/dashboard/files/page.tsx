'use client';
// src/app/(career-portal)/portal/dashboard/files/page.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FileItem {
  id: string; label: string; fileUrl: string;
  fileType: string; mimeType: string;
  fileCategory: string; createdAt: string;
  originalName: string;
}
interface RevisionItem {
  id: string; note: string; fileLabel?: string; status: string;
  requestedBy: string; adminNote?: string; createdAt: string;
}

const FILE_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  resume: {
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>,
    bg: 'bg-[#FBF8F3] border border-[#F0EAE0]',
  },
  cover_letter: {
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
    bg: 'bg-purple-50 border border-purple-100',
  },
  linkedin_banner: {
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#0891b2" strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#0891b2" strokeWidth="1.8"/><path stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>,
    bg: 'bg-cyan-50 border border-cyan-100',
  },
  linkedin_profile_picture: {
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="#0891b2" strokeWidth="1.8"/><path stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>,
    bg: 'bg-cyan-50 border border-cyan-100',
  },
  other: {
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>,
    bg: 'bg-slate-50 border border-slate-100',
  },
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DENIED:   'bg-red-50 text-red-700 border-red-200',
};

export default function FilesPage() {
  const router = useRouter();
  const [files,     setFiles]     = useState<FileItem[]>([]);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [copying,   setCopying]   = useState<string | null>(null);
  const [showRevModal, setShowRevModal] = useState(false);
  const [revFile,   setRevFile]   = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetch('/api/career/portal/deliverables'),
      fetch('/api/career/portal/revisions'),
    ]).then(async ([fRes, rRes]) => {
      if (fRes.status === 401) { router.replace('/portal/login'); return; }
      const [fData, rData] = await Promise.all([
        fRes.json() as Promise<{ files: FileItem[] }>,
        rRes.ok ? rRes.json() as Promise<{ revisions: RevisionItem[] }> : Promise.resolve({ revisions: [] }),
      ]);
      setFiles(fData.files ?? []);
      setRevisions(rData.revisions ?? []);
      setLoading(false);
    }).catch(() => router.replace('/portal/login'));
  }, [router]);

  const copyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const openRevision = (label: string) => {
    setRevFile(label);
    setShowRevModal(true);
  };

  const afterRevisionAdded = (rev: RevisionItem) => {
    setRevisions(prev => [rev, ...prev]);
  };

  const drafts = files.filter(f => f.fileCategory === 'draft');
  const finals = files.filter(f => f.fileCategory !== 'draft');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-[#F5F2EC]/30 to-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal/dashboard"
            className="flex items-center gap-1.5 text-slate-400 hover:text-[#B8935B] transition-colors flex-shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M19 12H5m7-7l-7 7 7 7"/>
            </svg>
            <span className="text-sm hidden sm:inline">Dashboard</span>
          </Link>
          <div className="w-px h-4 bg-slate-200" />
          <h1 className="text-sm font-bold text-slate-900">My Deliverables</h1>
          {!loading && files.length > 0 && (
            <span className="ml-auto text-xs text-slate-400">
              {drafts.length > 0 && `${drafts.length} draft${drafts.length !== 1 ? 's' : ''}`}
              {drafts.length > 0 && finals.length > 0 && ' · '}
              {finals.length > 0 && `${finals.length} final${finals.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-7 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Your Files</h2>
          <p className="text-slate-500 text-sm mt-1">
            Drafts are for review and feedback. Final deliverables are your completed documents.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && files.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                <path stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              </svg>
            </div>
            <p className="text-slate-700 font-bold mb-1">No files yet</p>
            <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
              Your deliverables will appear here once our team uploads them.
            </p>
            <Link href="/portal/dashboard"
              className="inline-block mt-6 px-5 py-2 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] transition-colors">
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* ── Draft Files ── */}
        {!loading && drafts.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Drafts for Review
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                {drafts.length}
              </span>
            </div>

            <div className="mb-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="#d97706" strokeWidth="2" strokeLinecap="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                Review each draft carefully and use the <strong>Request Revision</strong> button if you need any changes. You have <strong>2 revision rounds</strong> included in your package.
              </p>
            </div>

            <div className="space-y-3">
              {drafts.map(file => {
                const ft = FILE_ICONS[file.fileType] ?? FILE_ICONS.other;
                return (
                  <div key={file.id}
                    className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${ft.bg} rounded-xl flex items-center justify-center flex-shrink-0 relative`}>
                        {ft.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm truncate">{file.label}</p>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                            Draft
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 capitalize">
                            {file.fileType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">
                            {new Date(file.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyLink(file.fileUrl, file.id)}
                          title="Copy link"
                          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                            copying === file.id
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-600'
                              : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}>
                          {copying === file.id ? (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                          ) : (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                          )}
                        </button>
                        <a
                          href={`/api/career/portal/deliverables/preview?fileId=${file.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                          title="Preview">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </a>
                        <a href={`/api/career/portal/deliverables/download?fileId=${file.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 active:scale-95 transition-all">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          Download
                        </a>
                      </div>
                    </div>

                    {/* Revision request row */}
                    <div className="mt-3 pt-3 border-t border-amber-50 flex items-center justify-between">
                      <p className="text-xs text-slate-400">Need changes to this draft?</p>
                      <button
                        onClick={() => openRevision(file.label)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 hover:border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-all">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Request Revision
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Final Deliverables ── */}
        {!loading && finals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Final Deliverables
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                {finals.length}
              </span>
            </div>

            <div className="mb-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="#16a34a" strokeWidth="2" strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-emerald-800 leading-relaxed">
                These are your <strong>completed, final documents</strong>. Save them to Google Drive, Dropbox, or your local computer. Hosted links remain active for 30 days.
              </p>
            </div>

            <div className="space-y-3">
              {finals.map(file => {
                const ft = FILE_ICONS[file.fileType] ?? FILE_ICONS.other;
                return (
                  <div key={file.id}
                    className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${ft.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        {ft.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm truncate">{file.label}</p>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                            Final
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 capitalize">
                            {file.fileType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">
                            {new Date(file.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyLink(file.fileUrl, file.id)}
                          title="Copy link"
                          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                            copying === file.id
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-600'
                              : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}>
                          {copying === file.id ? (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                          ) : (
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                          )}
                        </button>
                        <a
                          href={`/api/career/portal/deliverables/preview?fileId=${file.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                          title="Preview">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </a>
                        <a href={`/api/career/portal/deliverables/download?fileId=${file.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8935B] text-white text-xs font-bold rounded-xl hover:bg-[#9A7540] active:scale-95 transition-all">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Revision Requests ── */}
        {!loading && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Revision Requests</h3>
              <button
                onClick={() => { setRevFile(''); setShowRevModal(true); }}
                className="text-xs font-semibold text-[#B8935B] border border-[#E8DDD0] px-3 py-1 rounded-lg hover:bg-[#FBF8F3] transition-colors">
                + New Request
              </button>
            </div>

            {revisions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No revision requests yet.</p>
            ) : (
              <div className="space-y-3">
                {revisions.map(r => (
                  <div key={r.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        {r.fileLabel && (
                          <p className="text-xs font-semibold text-slate-500 mb-0.5">Re: {r.fileLabel}</p>
                        )}
                        <p className="text-sm text-slate-800 leading-relaxed">{r.note}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? STATUS_STYLE.PENDING}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.adminNote && (
                      <div className="mt-2 px-3 py-2 bg-[#FBF8F3] border border-[#F0EAE0] rounded-lg">
                        <p className="text-xs text-[#9A7540]"><strong>Team note:</strong> {r.adminNote}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                      {r.requestedBy === 'admin' ? 'Created by Catalyst Team' : 'Requested by you'} · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Revision Modal */}
      {showRevModal && (
        <RevisionModal
          fileLabel={revFile}
          onClose={() => setShowRevModal(false)}
          onAdded={afterRevisionAdded}
        />
      )}
    </div>
  );
}

// ── Revision Request Modal ────────────────────────────────────────────────────

function RevisionModal({
  fileLabel,
  onClose,
  onAdded,
}: {
  fileLabel: string;
  onClose: () => void;
  onAdded: (r: RevisionItem) => void;
}) {
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/career/portal/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim(), fileLabel: fileLabel || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      const d = await res.json() as { revision: RevisionItem };
      onAdded(d.revision);
      setDone(true);
      setTimeout(onClose, 1800);
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Revision requested!</h3>
            <p className="text-sm text-slate-500">Our team has been notified and will review your request.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request a Revision</h3>
                {fileLabel && <p className="text-xs text-slate-400 mt-0.5">Re: {fileLabel}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-8 h-8 flex items-center justify-center">x</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Describe what needs to be changed
                </label>
                <textarea
                  required
                  rows={5}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Please update my job title on the resume to Senior Software Engineer, and fix the spacing in the skills section..."
                  className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 hover:bg-white resize-none transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{note.length}/2000</p>
              </div>
              <button
                type="submit"
                disabled={loading || note.trim().length < 5}
                className="w-full py-2.5 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? 'Submitting...' : 'Submit Revision Request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
