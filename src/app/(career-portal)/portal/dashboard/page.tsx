'use client';
// src/app/(career-portal)/portal/dashboard/page.tsx

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { CareerStatus, CareerPackage, FormType } from '@/lib/career/types';
import { PACKAGE_LABELS, STATUS_LABELS } from '@/lib/career/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormMeta { formType: string; version: number; submittedAt: string; }
interface Me {
  id: string; name: string; email: string;
  packageType: CareerPackage; packageLabel: string;
  status: CareerStatus; statusLabel: string;
  availableForms: FormType[];
  submittedForms: string[];
  forms: FormMeta[];
  createdAt: string;
  currency?: string;
  hasPinSet?: boolean;
}
interface DeliverableItem {
  id: string; label: string; fileUrl: string; fileType: string; createdAt: string;
}
interface CommentItem {
  id: string; authorType: string; authorName: string; content: string; createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_LABELS: Record<string, string> = {
  resume:       'Career Information Form',
  linkedin:     'LinkedIn Profile Information',
  cover_letter: 'Career Information Form',
};
const FORM_ICON_SVG: Record<string, React.ReactNode> = {
  resume: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
      <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round" d="M14 2v6h6M9 13h6M9 17h4"/>
    </svg>
  ),
  linkedin: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="#1f56d4" strokeWidth="1.8"/>
      <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round"
        d="M7 10v7M7 7v.5M12 17v-4a2 2 0 014 0v4M12 13v4"/>
    </svg>
  ),
  cover_letter: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
      <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round" d="M14 2v6h6M9 13h6M9 17h4"/>
    </svg>
  ),
};
const FORM_DESCS: Record<string, string> = {
  resume:       'Full name, career goals, experience, skills, achievements & cover letter details',
  linkedin:     'LinkedIn credentials, goals, industry, tone & profile optimisation preferences',
  cover_letter: 'Full name, career goals, experience, skills, achievements & cover letter details',
};

const STATUS_STEPS: { key: CareerStatus; label: string }[] = [
  { key: 'NOT_STARTED',   label: 'Not Started'    },
  { key: 'SUBMITTED',     label: 'Details Submitted' },
  { key: 'UNDER_PROCESS', label: 'Under Process'  },
  { key: 'DRAFT_SENT',    label: 'Draft Sent'     },
  { key: 'COMPLETED',     label: 'Completed'      },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [files, setFiles] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const load = useCallback(async () => {
    const [meRes, filesRes, commentsRes] = await Promise.all([
      fetch('/api/career/portal/me'),
      fetch('/api/career/portal/deliverables'),
      fetch('/api/career/portal/comments'),
    ]);
    if (meRes.status === 401) { router.replace('/portal/login'); return; }
    const [meData, filesData, commentsData] = await Promise.all([
      meRes.json() as Promise<Me>,
      filesRes.json() as Promise<{ files: DeliverableItem[] }>,
      commentsRes.ok ? commentsRes.json() as Promise<{ comments: CommentItem[] }> : Promise.resolve({ comments: [] }),
    ]);
    // Redirect to PIN setup if PIN not set yet
    if (!meData.hasPinSet) { router.replace('/portal/setup-pin'); return; }
    setMe(meData);
    setFiles(filesData.files ?? []);
    setComments(commentsData.comments ?? []);
    setLoading(false);
  }, [router]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPostingComment(true);
    const res = await fetch('/api/career/portal/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => [...prev, d.comment]);
      setNewComment('');
    }
    setPostingComment(false);
  };

  useEffect(() => { void load(); }, [load]);

  const logout = async () => {
    await fetch('/api/career/auth/verify', { method: 'DELETE' });
    router.push('/portal/login');
  };

  if (loading) return <DashboardSkeleton />;
  if (!me) return null;

  // Determine progress index (handle REVISION_REQUESTED as step 1)
  const currentKey = me.status === 'REVISION_REQUESTED' ? 'SUBMITTED' : me.status;
  const progressIdx = STATUS_STEPS.findIndex(s => s.key === currentKey);
  const allFormsSubmitted = me.availableForms.every(f => me.submittedForms.includes(f));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm shadow-slate-100/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0">
              <Image src="/Logo.jpg" width={32} height={32} alt="Ripple Nexus" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-tight tracking-tight">Ripple Nexus</p>
              <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded tracking-wide leading-none">
                ClientForge Boost
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {me.name[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium text-slate-700 max-w-[140px] truncate">{me.name}</span>
            </div>
            <button onClick={logout}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-7 space-y-5" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
        <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hi, {me.name.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Welcome to your ClientForge Boost portal</p>
        </div>

        {/* ── Package hero ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white">
          {/* decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-500/10" />
          <div className="absolute -right-4 -bottom-6 w-20 h-20 rounded-full bg-emerald-400/10" />

          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">Active Package</p>
                <h2 className="text-xl font-bold">{me.packageLabel}</h2>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold">
                {me.currency ?? ''}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                me.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                me.status === 'REVISION_REQUESTED' ? 'bg-orange-400/20 text-orange-300 border border-orange-400/30' :
                'bg-white/10 text-white border border-white/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  me.status === 'COMPLETED' ? 'bg-emerald-400' :
                  me.status === 'REVISION_REQUESTED' ? 'bg-orange-400' : 'bg-blue-400'
                } animate-pulse`} />
                {me.statusLabel}
              </div>
              {me.status === 'REVISION_REQUESTED' && (
                <span className="text-orange-300 text-xs font-medium">Revision in progress</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Progress tracker ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Your Progress</h3>
            <span className="text-xs text-slate-400">{progressIdx + 1} / {STATUS_STEPS.length}</span>
          </div>

          {/* Progress bar */}
          <div className="relative mb-6">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${(progressIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {STATUS_STEPS.map((step, idx) => {
              const done    = idx < progressIdx;
              const current = idx === progressIdx;
              const pending = idx > progressIdx;
              return (
                <div key={step.key} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  current ? 'bg-blue-50 border border-blue-200' :
                  done    ? 'bg-slate-50 border border-transparent' :
                            'border border-transparent opacity-50'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
                    current ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-110' :
                    done    ? 'bg-emerald-500 text-white' :
                              'bg-slate-200 text-slate-400'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${
                      current ? 'text-blue-700' : done ? 'text-slate-700' : 'text-slate-400'
                    }`}>{step.label}</p>
                    {current && me.status === 'NOT_STARTED' && (
                      <p className="text-xs text-blue-500 mt-0.5">Fill in your forms below to get started →</p>
                    )}
                    {current && me.status === 'SUBMITTED' && (
                      <p className="text-xs text-blue-500 mt-0.5">Our team is reviewing your submission</p>
                    )}
                    {current && me.status === 'UNDER_PROCESS' && (
                      <p className="text-xs text-blue-500 mt-0.5">Work in progress — we'll notify you when your draft is ready</p>
                    )}
                    {current && me.status === 'DRAFT_SENT' && (
                      <p className="text-xs text-blue-500 mt-0.5">
                        Check your email for the draft · <Link href="/portal/dashboard/files" className="underline">View in Files</Link>
                      </p>
                    )}
                    {current && me.status === 'COMPLETED' && (
                      <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                        All done! <Link href="/portal/dashboard/files" className="underline ml-0.5">Download your files</Link>
                      </p>
                    )}
                  </div>
                  {pending && <div className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Forms section ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Your Forms</h3>
            {allFormsSubmitted && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                All submitted ✓
              </span>
            )}
          </div>

          {me.availableForms.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No forms available for your package.</p>
          ) : (
            <div className="space-y-3">
              {me.availableForms.map(ft => {
                const submitted = me.submittedForms.includes(ft);
                const formMeta  = me.forms.find(f => f.formType === ft);
                return (
                  <Link key={ft} href={`/portal/dashboard/forms/${ft}`}
                    className={`group flex items-center justify-between p-4 border rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
                      submitted
                        ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}>
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                        submitted ? 'bg-emerald-100' : 'bg-slate-100'
                      }`}>
                        {FORM_ICON_SVG[ft] ?? (
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                          <path stroke="#1f56d4" strokeWidth="1.8" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                      )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{FORM_LABELS[ft] ?? ft}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {submitted
                            ? `v${formMeta?.version ?? 1} · Last updated ${fmtDate(formMeta?.submittedAt ?? '')}`
                            : FORM_DESCS[ft] ?? 'Provide your details'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {submitted ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                          Submitted ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                          Fill now
                        </span>
                      )}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors"
                        fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!allFormsSubmitted && me.availableForms.length > 0 && (
            <p className="mt-3 text-xs text-slate-400 text-center">
              Fill in all forms so our team can start working on your package.
            </p>
          )}
        </div>

        {/* ── Recent files ── */}
        {files.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Deliverables</h3>
              <Link href="/portal/dashboard/files"
                className="text-xs text-blue-600 hover:underline font-medium">
                View all ({files.length})
              </Link>
            </div>
            <div className="space-y-2">
              {files.slice(0, 3).map(file => (
                <div key={file.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                      {file.fileType === 'resume' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>
                      ) : file.fileType === 'linkedin_banner' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#1f56d4" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#1f56d4" strokeWidth="2"/><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
                      ) : file.fileType === 'cover_letter' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      ) : (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{file.label}</p>
                      <p className="text-xs text-slate-400">{fmtDate(file.createdAt)}</p>
                    </div>
                  </div>
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={e => e.stopPropagation()}>
                    ↓
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick links ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink href="/portal/dashboard/files" title="My Files" desc="View & download deliverables"
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>} />
          <QuickLink href="mailto:info@theripplenexus.com" title="Contact Us" desc="Write to our team" external
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} />
          <QuickLink href="https://www.theripplenexus.com" title="Our Website" desc="theripplenexus.com" external
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#1f56d4" strokeWidth="2"/><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>} />
        </div>

        {/* ── Comments / Messages ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Messages & Notes</h3>

          {/* Thread */}
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No messages yet. Leave a note for our team below.
              </p>
            ) : comments.map(c => (
              <div key={c.id} className={`flex gap-3 ${c.authorType === 'client' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  c.authorType === 'admin' ? 'bg-[#1f56d4] text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {c.authorType === 'admin' ? 'RN' : c.authorName[0]?.toUpperCase() ?? 'C'}
                </div>
                <div className={`max-w-[75%] ${c.authorType === 'client' ? 'items-end flex flex-col' : ''}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    c.authorType === 'admin'
                      ? 'bg-blue-50 border border-blue-100 text-slate-700 rounded-tl-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tr-sm'
                  }`}>
                    {c.content}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 px-1">
                    {c.authorType === 'admin' ? 'Ripple Nexus Team' : 'You'} · {fmtDate(c.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={postComment} className="flex gap-2 border-t border-slate-100 pt-4">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Type a message for the team…"
              maxLength={1000}
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={postingComment || !newComment.trim()}
              className="px-4 py-2.5 bg-[#1f56d4] text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {postingComment ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              )}
            </button>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs text-slate-300">
            ClientForge Boost by Ripple Nexus · <a href="mailto:info@theripplenexus.com" className="hover:text-slate-500 transition-colors">info@theripplenexus.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickLink({ href, icon, title, desc, external = false }: {
  href: string; icon: React.ReactNode; title: string; desc: string; external?: boolean;
}) {
  const cls = "group flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer";
  const inner = (
    <>
      <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">{title}</p>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
        fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 18l6-6-6-6"/>
      </svg>
    </>
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-14 bg-white border-b border-slate-200" />
      <div className="max-w-3xl mx-auto px-4 py-7 space-y-5 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-xl" />
        <div className="h-28 bg-slate-200 rounded-2xl" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
        <div className="h-48 bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );
}

// ── PIN Setup Banner ─────────────────────────────────────────────────────────

function PinSetupBanner() {
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) { setError('PINs do not match.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/career/auth/set-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) { setDone(true); setOpen(false); }
    else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed. Please try again.');
    }
    setSaving(false);
  };

  if (done) return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
      <p className="text-sm text-emerald-700 font-medium">PIN set successfully. You can now use it to sign in.</p>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#1f56d4" strokeWidth="2" strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Set a 6-digit PIN</p>
            <p className="text-xs text-slate-500 mt-0.5">Skip the email next time — sign in instantly with your PIN.</p>
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="flex-shrink-0 text-xs font-semibold text-[#1f56d4] hover:underline">
          {open ? 'Cancel' : 'Set PIN'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSet} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} required
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digits"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 tracking-[0.3em]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} required
                value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digits"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 tracking-[0.3em]" />
            </div>
          </div>
          <button type="submit" disabled={saving || pin.length !== 6 || confirm.length !== 6}
            className="w-full py-2 bg-[#1f56d4] text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save PIN'}
          </button>
        </form>
      )}
    </div>
  );
}


function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
