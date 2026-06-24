'use client';
// src/app/(career-portal)/portal/dashboard/page.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { CareerStatus, CareerPackage, FormType } from '@/lib/career/types';
import { PACKAGE_LABELS, STATUS_LABELS } from '@/lib/career/types';
import { DeliverableViewer } from '@/components/DeliverableViewer';
import { ClientFeedbackForms } from '@/components/ClientFeedbackForms';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormMeta { formType: string; version: number; submittedAt: string; }

interface RevisionSummary {
  slug: string; name: string; freeLimit: number; freeUsed: number; revisionsLeft: number; paidUsed: number;
}

interface Me {
  id: string; name: string; email: string;
  packageType: CareerPackage; packageLabel: string;
  status: CareerStatus; statusLabel: string;
  lifecycleStatus: string;
  availableForms: FormType[];
  submittedForms: string[];
  forms: FormMeta[];
  createdAt: string;
  completedAt?: string | null;
  currency?: string;
  hasPinSet?: boolean;
  revisionCount?: number;
  revisionsLeft?: number;
  revisionSummary?: RevisionSummary[];
  expectedDeliveryAt?: string | null;
  waitingOn?: string;
  services?: { slug: string; name: string }[];
  unreadMessages?: number;
  hasSubmittedFeedback?: boolean;
  hasSubmittedReview?: boolean;
  deliverables?: { fileType: string; fileCategory: string; label: string; approvalStatus: string }[];
}
interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  stats: {
    count: number;
    convertedCount: number;
    totalRevenue: number;
    referrals: { name: string; joinedAt: string; isConverted: boolean }[];
  };
}

interface DeliverableItem {
  id: string; label: string; fileUrl: string; fileType: string; createdAt: string;
  fileCategory: string; approvalStatus?: string;
}
interface Attachment { name: string; url: string; mimeType: string; size: number; }
interface CommentItem {
  id: string; authorType: string; authorName: string; content: string;
  attachments: Attachment[] | null;
  readByAdmin: boolean; readByClient: boolean;
  readByAdminAt: string | null; readByClientAt: string | null;
  createdAt: string; editedAt: string | null; isDeleted: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DocumentIcon = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
    <path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round" d="M14 2v6h6M9 13h6M9 17h4"/>
  </svg>
);
const LinkedInIcon = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="4" stroke="#B8935B" strokeWidth="1.8"/>
    <path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round"
      d="M7 10v7M7 7v.5M12 17v-4a2 2 0 014 0v4M12 13v4"/>
  </svg>
);
const WebIcon = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="#B8935B" strokeWidth="1.8"/>
    <path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
  </svg>
);

// Covers both legacy names (resume, linkedin, cover_letter) and new canonical names
const FORM_LABELS: Record<string, string> = {
  // New canonical names
  career_profile:    'Career Profile Strategy Brief',
  linkedin_profile:  'LinkedIn Profile Optimization Brief',
  portfolio_website: 'Portfolio Website Development Brief',
  // Legacy aliases (kept so old URL params still show correct labels)
  resume:            'Career Profile Strategy Brief',
  linkedin:          'LinkedIn Profile Optimization Brief',
  cover_letter:      'Career Profile Strategy Brief',
};
const FORM_ICON_SVG: Record<string, React.ReactNode> = {
  career_profile:    DocumentIcon,
  linkedin_profile:  LinkedInIcon,
  portfolio_website: WebIcon,
  resume:            DocumentIcon,
  linkedin:          LinkedInIcon,
  cover_letter:      DocumentIcon,
};
const FORM_DESCS: Record<string, string> = {
  career_profile:    'Full name, career goals, experience, skills & achievements',
  linkedin_profile:  'LinkedIn credentials, goals, industry, tone & optimisation preferences',
  portfolio_website: 'Bio, projects, skills, design preferences & website goals',
  resume:            'Full name, career goals, experience, skills & achievements',
  linkedin:          'LinkedIn credentials, goals, industry, tone & optimisation preferences',
  cover_letter:      'Full name, career goals, experience, skills & achievements',
};

const STATUS_STEPS: { key: CareerStatus | 'REVISION_IN_PROGRESS'; label: string }[] = [
  { key: 'NOT_STARTED',          label: 'Payment Received'      },
  { key: 'SUBMITTED',            label: 'Details Submitted'     },
  { key: 'UNDER_PROCESS',        label: 'Under Process'         },
  { key: 'DRAFT_SENT',           label: 'Draft Sent'            },
  { key: 'REVISION_IN_PROGRESS', label: 'Revision In Progress'  },
  { key: 'COMPLETED',            label: 'Final Delivered'       },
];

// ── Portal service helpers ─────────────────────────────────────────────────────

function getPortalTierLabel(slugs: string[]): string {
  if (slugs.includes('PREMIUM_PLUS') || slugs.includes('PORTFOLIO')) return 'Premium Plus Package';
  if (slugs.includes('FULL_PACKAGE') || (['RESUME', 'COVER_LETTER', 'LINKEDIN'].every(s => slugs.includes(s)))) return 'Career Booster Package';
  if (slugs.includes('RESUME') && slugs.includes('COVER_LETTER')) return 'Resume & Cover Letter';
  if (slugs.includes('RESUME')) return 'Resume Writing';
  return 'Your Package';
}

function portalServiceChips(files: { fileType: string; label: string }[]): { type: string; label: string }[] {
  const seen = new Set<string>();
  return files.reduce<{ type: string; label: string }[]>((acc, d) => {
    const k = d.fileType.startsWith('linkedin') ? 'linkedin' : d.fileType;
    if (!seen.has(k)) {
      seen.add(k);
      acc.push({ type: k, label: k === 'linkedin' ? 'LinkedIn Profile' : (d.label || d.fileType.replace(/_/g, ' ')) });
    }
    return acc;
  }, []);
}

function portalChipIcon(type: string) {
  if (type === 'resume') return (
    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
      <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  );
  if (type === 'cover_letter') return (
    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
      <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  );
  if (type === 'linkedin') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  );
  if (type === 'portfolio') return (
    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" style={{flexShrink:0}}>
      <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
    </svg>
  );
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [files, setFiles] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [approvingFileId, setApprovingFileId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState<DeliverableItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const threadRef     = useRef<HTMLDivElement>(null);
  const composeRef    = useRef<HTMLTextAreaElement>(null);
  const editRef       = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
    setTimeout(() => { if (editRef.current) { autoResize(editRef.current); editRef.current.focus(); } }, 0);
  };

  const cancelEdit = () => { setEditingId(null); setEditContent(''); };

  const deleteComment = async (id: string) => {
    const res = await fetch('/api/career/portal/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: id }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => prev.map(c => c.id === id ? d.comment : c));
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    setSavingEdit(true);
    const res = await fetch('/api/career/portal/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: editingId, content: editContent.trim() }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => prev.map(c => c.id === editingId ? d.comment : c));
      cancelEdit();
    }
    setSavingEdit(false);
  };

  const scrollThread = () => {
    setTimeout(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, 50);
  };

  const [referral, setReferral] = useState<ReferralStats | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const handleUpgrade = async (targetService: string) => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/career/portal/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetService }),
      });
      const data = await res.json();
      if (data.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error || 'Failed to initialize upgrade');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
    setUpgrading(false);
  };

  const load = useCallback(async () => {
    const [meRes, filesRes, commentsRes, referralRes] = await Promise.all([
      fetch('/api/career/portal/me'),
      fetch('/api/career/portal/deliverables'),
      fetch('/api/career/portal/comments'),
      fetch('/api/career/portal/referral'),
    ]);
    if (meRes.status === 401) { router.replace('/portal/login'); return; }
    const [meData, filesData, commentsData, referralData] = await Promise.all([
      meRes.json() as Promise<Me>,
      filesRes.json() as Promise<{ files: DeliverableItem[] }>,
      commentsRes.ok
        ? commentsRes.json() as Promise<{ comments: CommentItem[] }>
        : Promise.resolve({ comments: [] }),
      referralRes.ok
        ? referralRes.json() as Promise<ReferralStats>
        : Promise.resolve(null),
    ]);
    if (!meData.hasPinSet) { router.replace('/portal/setup-pin'); return; }
    setMe(meData);
    setFiles(filesData.files ?? []);
    setComments(commentsData.comments ?? []);
    setReferral(referralData);
    setLoading(false);
    scrollThread();
  }, [router]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (pendingFiles.length + files.length > 3) {
      alert('Max 3 attachments per message.'); return;
    }

    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 4MB edge limit. Please compress it.`);
        return;
      }
    }

    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/career/portal/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const att = await res.json() as Attachment;
        setPendingFiles(prev => [...prev, att]);
      } else {
        if (res.status === 413) {
          alert(`File ${file.name} rejected by server: Payload Too Large (>4.5MB).`);
        } else {
          alert(`Upload failed for ${file.name}`);
        }
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && pendingFiles.length === 0) return;
    setPostingComment(true);
    const res = await fetch('/api/career/portal/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim(), attachments: pendingFiles }),
    });
    if (res.ok) {
      const d = await res.json() as { comment: CommentItem };
      setComments(prev => [...prev, d.comment]);
      setNewComment('');
      setPendingFiles([]);
      scrollThread();
    }
    setPostingComment(false);
  };

  const approveFile = async (fileId: string) => {
    setApprovingFileId(fileId);
    const res = await fetch(`/api/career/portal/deliverables/${fileId}/approve`, { method: 'POST' });
    if (res.ok) {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, approvalStatus: 'APPROVED' } : f));
    } else {
      alert('Failed to approve file.');
    }
    setApprovingFileId(null);
  };

  useEffect(() => { void load(); }, [load]);

  const logout = async () => {
    await fetch('/api/career/auth/verify', { method: 'DELETE' });
    router.push('/portal/login');
  };

  // Map status to step key
  const currentKey = useMemo(() => {
    if (!me) return '';
    if (me.status === 'REVISION_REQUESTED') return 'REVISION_IN_PROGRESS';
    return me.status;
  }, [me]);

  const progressIdx = useMemo(() => STATUS_STEPS.findIndex(s => s.key === currentKey), [currentKey]);
  
  const allFormsSubmitted = useMemo(() => {
    if (!me) return false;
    return me.availableForms.every(f => me.submittedForms.includes(f));
  }, [me]);

  if (loading) return <DashboardSkeleton />;
  if (!me) return null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-[#F5F2EC]/30 to-[#FAFAF8]">
      {/* ── Navbar ── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm shadow-slate-100/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 bg-black flex items-center justify-center">
              <Image src="/logos/catalyst-symbol-dark.svg" width={20} height={20} alt="Catalyst" className="object-contain" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-tight tracking-tight">Catalyst</p>
              <span className="inline-block px-1.5 py-0.5 bg-[#F0EAE0] text-[#9A7540] text-[9px] font-bold rounded tracking-wide leading-none">
                ClientForge Boost
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (threadRef.current) {
                threadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }} className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {me.unreadMessages ? (
                <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              ) : null}
            </button>
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-slate-100 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#B8935B] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {me.name[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium text-slate-700 max-w-[80px] sm:max-w-[140px] truncate">{me.name.split(' ')[0]}</span>
            </div>
            <button onClick={logout} aria-label="Sign out"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 sm:px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
        <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-2xl sm:text-display font-semibold text-slate-900">
            Hi, {me.name.split(' ')[0]}
          </h1>
          <p className="text-sm sm:text-subheading text-slate-500 mt-1 sm:mt-2">Welcome to your ClientForge Boost portal</p>
        </div>

        {me.lifecycleStatus === 'ARCHIVED' && (
          <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md border border-slate-700">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              This project has been archived
            </h3>
            <p className="text-sm text-slate-300">
              To request additional work, revisions, or start a new project, please reply to your project manager or contact support. Your files will remain available for download.
            </p>
          </div>
        )}

        {/* ── Package hero ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0A0B0D] via-[#1C1812] to-[#0A0B0D] rounded-2xl p-6 text-white">
          {/* decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#B8935B]/10" />
          <div className="absolute -right-4 -bottom-6 w-20 h-20 rounded-full bg-emerald-400/10" />

          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[#D4AF7A] text-xs font-semibold uppercase tracking-widest mb-1">Active Package</p>
                <h2 className="text-xl font-bold">{me.packageLabel}</h2>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold">
                {me.currency ?? ''}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                me.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                me.status === 'REVISION_REQUESTED' ? 'bg-orange-400/20 text-orange-300 border border-orange-400/30' :
                'bg-white/10 text-white border border-white/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  me.status === 'COMPLETED' ? 'bg-emerald-400' :
                  me.status === 'REVISION_REQUESTED' ? 'bg-orange-400' : 'bg-[#C4A070]'
                } animate-pulse`} />
                {me.statusLabel}
              </div>
              {me.waitingOn && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  me.waitingOn === 'CLIENT' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                }`}>
                  Waiting: {me.waitingOn === 'CLIENT' ? 'YOU' : 'CATALYST'}
                </div>
              )}
              {me.status === 'REVISION_REQUESTED' && (
                <span className="text-orange-300 text-xs font-medium">Revision in progress</span>
              )}
            </div>
            {me.services && me.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {me.services.map(s => (
                  <span key={s.slug}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70 border border-white/15">
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row: Revisions + Delivery Date ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Revisions (per-service progress bars) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Free Revisions</p>
            {/* 15-day post-delivery window notice */}
            {me.status === 'COMPLETED' && me.completedAt && (() => {
              const days = Math.floor((Date.now() - new Date(me.completedAt!).getTime()) / (1000 * 60 * 60 * 24));
              const daysLeft = 15 - days;
              if (daysLeft <= 0) return (
                <p className="text-[11px] text-red-500 font-medium mb-2 flex items-center gap-1">
                  <span>⚠️</span> Revision window closed · contact us for paid support
                </p>
              );
              if (daysLeft <= 5) return (
                <p className="text-[11px] text-amber-600 font-medium mb-2">
                  {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your free revision window
                </p>
              );
              return null;
            })()}
            {me.revisionSummary && me.revisionSummary.length > 0 ? (
              <div className="space-y-3">
                {me.revisionSummary.map(s => {
                  const pct = Math.round((s.freeUsed / s.freeLimit) * 100);
                  const exhausted = s.revisionsLeft === 0;
                  return (
                    <div key={s.slug}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600 truncate max-w-[160px]" title={s.name}>{s.name}</span>
                        <span className={`text-xs font-bold ${exhausted ? 'text-red-500' : 'text-slate-700'}`}>
                          {s.freeUsed} <span className="font-normal text-slate-400">/ {s.freeLimit} used</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${exhausted ? 'bg-red-400' : s.freeUsed > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {exhausted && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium">Contact us for a paid revision</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-1.5 mb-2">
                  <span className="text-2xl font-bold text-slate-900">{me.revisionsLeft ?? 2}</span>
                  <span className="text-sm text-slate-400 mb-0.5">/ 2 left</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${((2 - (me.revisionsLeft ?? 2)) / 2) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Expected delivery */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Expected Delivery</p>
            {me.expectedDeliveryAt ? (
              <>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {new Date(me.expectedDeliveryAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-slate-400 mt-1">5 business days from submission</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-400 leading-tight">Pending</p>
                <p className="text-xs text-slate-300 mt-1">Submit your form to set date</p>
              </>
            )}
          </div>
        </div>

        {/* ── Progress tracker (Reach-Style Vertical Timeline) ── */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 sm:p-8 hover-lift">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-metadata font-bold text-slate-400 uppercase tracking-widest">Project Journey</h3>
            <span className="text-sm font-medium text-slate-400">{progressIdx + 1} / {STATUS_STEPS.length}</span>
          </div>

          {/* Steps */}
          <div className="relative pl-4 space-y-6">
            <div className="absolute top-4 bottom-4 left-[31px] w-0.5 bg-slate-100" />
            {STATUS_STEPS.map((step, idx) => {
              const done    = idx < progressIdx;
              const current = idx === progressIdx;
              const pending = idx > progressIdx;
              return (
                <div key={step.key} className="relative z-10 flex items-start gap-5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all border-4 border-white ${
                    current ? 'bg-[#B8935B] text-white shadow-md scale-125' :
                    done    ? 'bg-emerald-500 text-white' :
                              'bg-slate-200 text-slate-400'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className={`flex-1 pt-1 ${!current && !done ? 'opacity-50' : ''}`}>
                    <p className={`text-body font-semibold ${
                      current ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-500'
                    }`}>{step.label}</p>
                    {current && me.status === 'NOT_STARTED' && (
                      <p className="text-sm text-slate-500 mt-1">Fill in your forms below to get started</p>
                    )}
                    {current && me.status === 'SUBMITTED' && (
                      <p className="text-sm text-slate-500 mt-1">Our team is reviewing your submission</p>
                    )}
                    {current && me.status === 'UNDER_PROCESS' && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-sm text-slate-500">Work in progress — we&apos;ll notify you when your draft is ready</p>
                        <div className="flex items-center gap-2">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" style={{color:'#B8935B',flexShrink:0}}>
                            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                          <span className="text-xs font-semibold text-amber-700">
                            {getPortalTierLabel(me.services?.map(s => s.slug) ?? [])}
                          </span>
                          <span className="text-[10px] text-amber-500 ml-auto">In Progress</span>
                        </div>
                      </div>
                    )}
                    {current && me.status === 'DRAFT_SENT' && (() => {
                      const drafts = portalServiceChips((me.deliverables ?? []).filter(d => d.fileCategory === 'draft'));
                      return (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-slate-500">
                            Your draft{drafts.length > 1 ? 's are' : ' is'} ready —{' '}
                            <Link href="/portal/dashboard/files" className="font-semibold text-[#B8935B] hover:underline">view in Files</Link>
                          </p>
                          {drafts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {drafts.map(c => (
                                <span key={c.type} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 border border-purple-100 text-purple-700">
                                  {portalChipIcon(c.type)}
                                  {c.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {current && me.status === 'REVISION_REQUESTED' && (
                      <p className="text-sm text-orange-500 mt-1">Your revision is being worked on</p>
                    )}
                    {current && me.status === 'COMPLETED' && (() => {
                      const finals = portalServiceChips((me.deliverables ?? []).filter(d => d.fileCategory !== 'draft'));
                      return (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
                            All done!{' '}
                            <Link href="/portal/dashboard/files" className="underline ml-1 hover:text-emerald-700">Download your files</Link>
                          </p>
                          {finals.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {finals.map(c => (
                                <span key={c.type} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 border border-emerald-100 text-emerald-700">
                                  {portalChipIcon(c.type)}
                                  {c.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Premium Upgrade Banner ── */}
        {me.services && (() => {
          const slugs = me.services.map(s => s.slug);
          const hasFull = slugs.includes('FULL_PACKAGE');
          const hasPortfolio = slugs.includes('PORTFOLIO');
          
          if (hasFull && hasPortfolio) return null; // Fully upgraded
          
          const target = hasFull ? 'PREMIUM_PLUS' : 'FULL_PACKAGE';
          const title = hasFull ? 'Premium Upgrade Available' : 'Package Upgrade Available';
          const desc = hasFull 
            ? 'Strengthen your digital credibility further through a dedicated professional portfolio website.'
            : 'Upgrade to the Complete Career Booster package to maximize your professional visibility.';
            
          return (
            <div className="bg-gradient-to-r from-[#B8935B]/10 to-[#B8935B]/5 border border-[#B8935B]/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#9A7540] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B8935B] animate-pulse"></span>
                  {title}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 max-w-md leading-relaxed">{desc}</p>
              </div>
              <button 
                onClick={() => handleUpgrade(target)}
                disabled={upgrading}
                className="whitespace-nowrap px-4 py-2 bg-[#B8935B] text-white text-xs font-bold rounded-xl hover:bg-[#9A7540] transition-colors disabled:opacity-50 shadow-sm shadow-[#B8935B]/20"
              >
                {upgrading ? 'Processing...' : 'View Upgrade Details'}
              </button>
            </div>
          );
        })()}

        {/* ── Feedback & Testimonial (Visible after completion) ── */}
        {me.status === 'COMPLETED' && (!me.hasSubmittedFeedback || !me.hasSubmittedReview) && (
          <ClientFeedbackForms 
            hasSubmittedFeedback={me.hasSubmittedFeedback ?? false} 
            hasSubmittedReview={me.hasSubmittedReview ?? false} 
            onSubmitted={() => void load()} 
          />
        )}

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

          {me.availableForms.length > 0 && (() => {
            const submittedCount = me.availableForms.filter(ft => me.submittedForms.includes(ft)).length;
            const total = me.availableForms.length;
            const pct = Math.round((submittedCount / total) * 100);
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>Form Progress</span>
                  <span className="font-semibold text-slate-600">{submittedCount} / {total} submitted</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#B8935B] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}

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
                        : 'border-slate-200 hover:border-[#D4AF7A] hover:bg-[#FBF8F3]/30'
                    }`}>
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                        submitted ? 'bg-emerald-100' : 'bg-slate-100'
                      }`}>
                        {FORM_ICON_SVG[ft] ?? (
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                          <path stroke="#B8935B" strokeWidth="1.8" strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
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
                        <span className="px-2.5 py-1 bg-[#F0EAE0] text-[#9A7540] text-xs font-bold rounded-full">
                          Fill now
                        </span>
                      )}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-[#B8935B] transition-colors"
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
                className="text-xs text-[#B8935B] hover:underline font-medium">
                View all ({files.length})
              </Link>
            </div>
            <div className="space-y-2">
              {files.slice(0, 3).map(file => (
                <div key={file.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-[#FBF8F3] hover:border-[#E8DDD0] hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FBF8F3] border border-[#F0EAE0] flex items-center justify-center flex-shrink-0">
                      {file.fileType === 'resume' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4"/></svg>
                      ) : file.fileType === 'linkedin_banner' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#B8935B" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#B8935B" strokeWidth="2"/><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
                      ) : file.fileType === 'cover_letter' ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      ) : (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{file.label}</p>
                      <p className="text-xs text-slate-400">{fmtDate(file.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.fileCategory === 'final' && file.approvalStatus === 'PENDING' && (
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); approveFile(file.id); }} disabled={approvingFileId === file.id}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50">
                        {approvingFileId === file.id ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                    {file.fileCategory === 'final' && file.approvalStatus === 'APPROVED' && (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded border border-emerald-200">
                        APPROVED ✓
                      </span>
                    )}
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewingFile(file); }}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">
                      View
                    </button>
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download
                      className="px-3 py-1.5 bg-[#B8935B] text-white text-xs font-bold rounded-lg hover:bg-[#9A7540] transition-colors"
                      onClick={e => e.stopPropagation()}>
                      ↓
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Referral Section ── */}
        {referral && <ReferralSection data={referral} />}

        {/* ── Quick links ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink href="/portal/dashboard/files" title="My Files" desc="View & download deliverables"
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>} />
          <QuickLink href="mailto:catalyst@theripplenexus.com" title="Contact Us" desc="Write to our team" external
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} />
          <QuickLink href="https://catalyst.theripplenexus.com" title="Our Website" desc="catalyst.theripplenexus.com" external
            icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#B8935B" strokeWidth="2"/><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>} />
        </div>

        {/* ── Comments / Messages ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Messages & Notes</h3>
            {me.unreadMessages ? (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                {me.unreadMessages} new
              </span>
            ) : null}
          </div>

          {/* Thread */}
          <div ref={threadRef} className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No messages yet. Leave a note for our team below.
              </p>
            ) : comments.map((c, i) => {
              const prev = comments[i - 1];
              const isSameAuthor = prev && prev.authorType === c.authorType;
              const isCloseInTime = prev && (new Date(c.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000);
              const showHeader = !(isSameAuthor && isCloseInTime);
              if (editingId === c.id) {
                return (
                  <div key={c.id} className="mt-5 flex gap-3">
                    <div className="w-10 flex-shrink-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold bg-slate-200 text-slate-700 shadow-sm">
                        {me?.name?.[0]?.toUpperCase() ?? 'C'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea
                        ref={editRef}
                        value={editContent}
                        onChange={e => { setEditContent(e.target.value); autoResize(e.target); }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { void saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#B8935B] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B]/30 bg-white resize-none leading-relaxed overflow-hidden"
                        style={{ minHeight: '2.5rem' }}
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={saveEdit} disabled={savingEdit || !editContent.trim()} className="px-3 py-1 bg-[#B8935B] text-white text-xs font-bold rounded-lg hover:bg-[#9A7540] disabled:opacity-50 transition-colors">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={cancelEdit} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                        <span className="text-[10px] text-slate-300">Ctrl+Enter · Esc to cancel</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return <PortalMessageBubble key={c.id} c={c} myName={me?.name ?? ''} showHeader={showHeader} onEdit={startEdit} onDelete={deleteComment} />;
            })}
          </div>

          {/* Pending attachments preview */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {pendingFiles.map((f, i) => (
                <PortalAttachmentChip key={i} att={f} onRemove={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}

          {/* Compose */}
          {me.lifecycleStatus === 'ARCHIVED' ? (
            <div className="border-t border-slate-100 pt-4 text-center">
              <p className="text-sm text-slate-400 italic">This project is archived. New messages and uploads are disabled.</p>
            </div>
          ) : (
            <form onSubmit={postComment} className="border-t border-slate-100 pt-4">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={composeRef}
                  value={newComment}
                  onChange={e => { setNewComment(e.target.value); autoResize(e.target); }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void postComment(e as unknown as React.FormEvent); } }}
                  placeholder="Type a message for the team… (Ctrl+Enter to send)"
                  maxLength={4000}
                  rows={2}
                  className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 hover:bg-white transition-colors resize-none overflow-hidden"
                  style={{ minHeight: '2.5rem' }}
                />
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={uploading || pendingFiles.length >= 3}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file (PNG, JPG, PDF, DOCX — max 4 MB)"
                    aria-label="Attach file"
                    className="p-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-[#FBF8F3] hover:border-[#D4AF7A] hover:text-[#B8935B] disabled:opacity-40 transition-colors"
                  >
                    {uploading
                      ? <span className="w-4 h-4 border-2 border-[#B8935B] border-t-transparent rounded-full animate-spin inline-block" />
                      : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    }
                  </button>
                  <button
                    type="submit"
                    disabled={postingComment || (!newComment.trim() && pendingFiles.length === 0)}
                    aria-label="Send message"
                    className="p-2.5 bg-[#B8935B] text-white rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors"
                  >
                    {postingComment
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    }
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.doc"
                onChange={handleFileSelect}
              />

              {viewingFile && (
                <DeliverableViewer 
                  fileUrl={viewingFile.fileUrl}
                  fileId={viewingFile.id}
                  fileName={viewingFile.label}
                  onClose={() => setViewingFile(null)}
                  onSubmitAnnotation={async (x, y, comment) => {
                    await fetch('/api/career/portal/comments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        content: `[Pin on ${viewingFile.label}]: ${comment}`,
                        annotationX: x,
                        annotationY: y 
                      })
                    });
                    load();
                  }}
                />
              )}
              <p className="text-[10px] text-slate-300 mt-1.5 px-1">PNG, JPG, PDF, DOCX · max 4 MB · max 3 files</p>
            </form>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs text-slate-300">
            ClientForge Boost by Catalyst · <a href="mailto:catalyst@theripplenexus.com" className="hover:text-slate-500 transition-colors">catalyst@theripplenexus.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function PortalAttachmentChip({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  const isImg = att.mimeType.startsWith('image/');
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FBF8F3] border border-[#E8DFD0] rounded-lg text-xs text-slate-700 max-w-[180px]">
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.url} alt="preview" className="w-4 h-4 rounded-sm object-cover border border-slate-200 flex-shrink-0" />
      ) : (
        <span className="text-base leading-none">📎</span>
      )}
      <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
        className="truncate hover:text-[#B8935B] transition-colors flex-1 min-w-0">
        {att.name}
      </a>
      <span className="text-slate-400 flex-shrink-0">{fmtBytes(att.size)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove attachment"
          className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ml-0.5">
          ×
        </button>
      )}
    </div>
  );
}

function PortalMessageBubble({ c, myName, showHeader = true, onEdit, onDelete }: {
  c: CommentItem; myName: string; showHeader?: boolean;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isClient = c.authorType === 'client';
  const atts = c.attachments ?? [];
  const authorName = isClient ? myName : 'Catalyst Team';
  const avatarChar = isClient ? (myName[0]?.toUpperCase() ?? 'C') : 'C';

  return (
    <div className={`group flex gap-4 ${!showHeader ? 'mt-1' : 'mt-5'}`}>
      {/* Avatar Column */}
      <div className="w-10 flex-shrink-0 flex justify-center">
        {showHeader ? (
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm ${
            isClient ? 'bg-slate-200 text-slate-700' : 'bg-[#B8935B] text-white'
          }`}>
            {avatarChar}
          </div>
        ) : (
          <div className="w-10 opacity-0 group-hover:opacity-100 flex justify-center items-center text-[10px] text-slate-400 font-medium select-none">
             {fmtTime(c.createdAt)}
          </div>
        )}
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0 pb-0.5">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-bold text-slate-900">{authorName}</span>
            <span className="text-xs font-medium text-slate-400">{fmtTime(c.createdAt)}</span>
            {c.editedAt && <span className="text-[10px] text-slate-400 italic">(edited)</span>}
          </div>
        )}

        {/* Bubble Content */}
        {c.isDeleted ? (
          <div className="flex items-center gap-1.5 text-slate-400 italic text-sm">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
            This message was deleted
          </div>
        ) : c.content && (
          <div className="relative group/msg">
            <div className="text-body text-slate-700 leading-relaxed whitespace-pre-wrap break-words [word-break:break-word]">
              {c.content}
            </div>
            {isClient && (onEdit || onDelete) && (
              <div className="absolute -top-1 -right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5">
                {onEdit && (
                  <button onClick={() => onEdit(c.id, c.content)}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-700 shadow-sm" title="Edit">
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                {onDelete && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm" title="Delete">
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
            {confirmDelete && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-red-600 font-medium">Delete for everyone?</span>
                <button onClick={() => { onDelete?.(c.id); setConfirmDelete(false); }}
                  className="px-2 py-0.5 bg-red-500 text-white rounded font-bold hover:bg-red-600 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Attachments - Images */}
        {atts.filter(a => a.mimeType.startsWith('image/')).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {atts.filter(a => a.mimeType.startsWith('image/')).map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name}
                  className="max-w-[240px] max-h-[180px] rounded-xl object-cover border border-slate-200 hover:opacity-90 hover:shadow-md transition-all cursor-pointer" />
              </a>
            ))}
          </div>
        )}

        {/* Attachments - Files */}
        {atts.filter(a => !a.mimeType.startsWith('image/')).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {atts.filter(a => !a.mimeType.startsWith('image/')).map((a, i) => (
              <PortalAttachmentChip key={i} att={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({ href, icon, title, desc, external = false }: {
  href: string; icon: React.ReactNode; title: string; desc: string; external?: boolean;
}) {
  const cls = "group flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#D4AF7A] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer";
  const inner = (
    <>
      <div className="w-9 h-9 bg-[#FBF8F3] border border-[#F0EAE0] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#F0EAE0] transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-[#9A7540] transition-colors truncate">{title}</p>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-[#B8935B] group-hover:translate-x-0.5 transition-all flex-shrink-0"
        fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M9 18l6-6-6-6"/>
      </svg>
    </>
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
}

function ReferralSection({ data }: { data: ReferralStats }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing silently
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#FBF8F3] border border-[#F0EAE0] rounded-xl flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Refer a Friend</h3>
      </div>

      <p className="text-sm text-slate-500 mb-4 leading-relaxed">
        Know someone who needs a career boost? Share your unique link and help them get started — and we will acknowledge your contribution.
      </p>

      {data.referralLink ? (
        <div className="flex gap-2 mb-5">
          <input
            readOnly
            value={data.referralLink}
            className="flex-1 px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono truncate focus:outline-none"
          />
          <button
            onClick={copy}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-[#B8935B] text-white hover:bg-[#9A7540]'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic mb-5">Referral link not available yet. Please check back after your account is fully set up.</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-900">{data.stats.count}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Referred</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{data.stats.convertedCount}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Converted</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[#B8935B]">
            {data.stats.count > 0 ? Math.round((data.stats.convertedCount / data.stats.count) * 100) : 0}%
          </p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Rate</p>
        </div>
      </div>

      {data.stats.referrals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Your Referrals</p>
          <div className="space-y-2">
            {data.stats.referrals.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">{r.name}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  r.isConverted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {r.isConverted ? 'Client' : 'Lead'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-[#F5F2EC]/30 to-[#FAFAF8]">
      <header className="bg-white/90 border-b border-slate-200 h-14 flex items-center px-4">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse" />
            <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 sm:w-32 h-8 rounded-xl bg-slate-200 animate-pulse" />
            <div className="w-10 sm:w-20 h-8 rounded-xl bg-slate-200 animate-pulse" />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-7 space-y-5">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </main>
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
          <div className="w-8 h-8 bg-[#FBF8F3] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path stroke="#B8935B" strokeWidth="2" strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Set a 6-digit PIN</p>
            <p className="text-xs text-slate-500 mt-0.5">Skip the email next time — sign in instantly with your PIN.</p>
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="flex-shrink-0 text-xs font-semibold text-[#B8935B] hover:underline">
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 tracking-[0.3em]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={6} required
                value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digits"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8935B] bg-slate-50 tracking-[0.3em]" />
            </div>
          </div>
          <button type="submit" disabled={saving || pin.length !== 6 || confirm.length !== 6}
            className="w-full py-2 bg-[#B8935B] text-white text-sm font-bold rounded-xl hover:bg-[#9A7540] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
