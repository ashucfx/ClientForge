'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { IconCheck, IconCopy } from '@/components/Icons';

interface ReviewRow {
  id: string;
  rating: number;
  testimonial: string;
  designation: string | null;
  company: string | null;
  linkedinUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  careerClient: { id: string; name: string; email: string } | null;
  rnClient: { id: string; name: string; email: string } | null;
}

const AVATAR_GRADIENTS = [
  'from-[#B8935B] to-[#8B6B3D]',
  'from-[#6366F1] to-[#4338CA]',
  'from-[#10B981] to-[#059669]',
  'from-[#F59E0B] to-[#D97706]',
  'from-[#EC4899] to-[#DB2777]',
  'from-[#8B5CF6] to-[#7C3AED]',
];

function avatarGradient(name: string) {
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 18 : size === 'md' ? 15 : 12;
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={px} height={px} viewBox="0 0 24 24"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
          strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

function PublishedDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/testimonials`
    : '/testimonials';

  const copyLink = () => {
    void navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/reviews');
    if (res.ok) {
      const data = await res.json() as { reviews: ReviewRow[] };
      setReviews(data.reviews ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const togglePublish = async (id: string, current: boolean) => {
    setTogglingId(id);
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !current }),
    });
    setReviews(prev => prev.map(r => r.id === id ? { ...r, isPublished: !current } : r));
    setTogglingId(null);
  };

  const filtered = reviews.filter(r => {
    if (filter === 'published') return r.isPublished;
    if (filter === 'unpublished') return !r.isPublished;
    return true;
  });

  const publishedCount = reviews.filter(r => r.isPublished).length;
  const fiveStarCount = reviews.filter(r => r.rating === 5).length;
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 pb-16">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-8 text-white shadow-md">
          {/* Decorative background quote */}
          <div aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 text-[140px] sm:text-[180px] leading-none font-serif text-white opacity-[0.03] select-none pointer-events-none">
            &ldquo;
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B]" />
                <span className="text-[#B8935B] text-xs font-bold tracking-widest uppercase">Deliverables & Growth</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Client Testimonials</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-lg">
                Authentic feedback from verified clients. Publish to your public testimonials page to showcase social proof and build trust.
              </p>
            </div>

            {/* Stat pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full lg:w-auto">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2.5 text-center">
                <p className="text-lg sm:text-2xl font-extrabold text-white">{reviews.length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">Total</p>
              </div>
              <div className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/20 rounded-xl px-3.5 py-2.5 text-center">
                <p className="text-lg sm:text-2xl font-extrabold text-emerald-400">{publishedCount}</p>
                <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider mt-0.5">Live</p>
              </div>
              <div className="bg-[#B8935B]/20 backdrop-blur-sm border border-[#B8935B]/30 rounded-xl px-3.5 py-2.5 text-center">
                <p className="text-lg sm:text-2xl font-extrabold text-[#B8935B]">{avgRating ?? '—'}</p>
                <p className="text-[10px] text-[#B8935B]/80 uppercase font-bold tracking-wider mt-0.5">Avg ★</p>
              </div>
              <div className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl px-3.5 py-2.5 text-center">
                <p className="text-lg sm:text-2xl font-extrabold text-amber-400">{fiveStarCount}</p>
                <p className="text-[10px] text-amber-300 uppercase font-bold tracking-wider mt-0.5">5-Star</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter bar & Public link ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
            {(['all', 'published', 'unpublished'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap capitalize ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'all' && `All (${reviews.length})`}
                {tab === 'published' && `Live (${publishedCount})`}
                {tab === 'unpublished' && `Pending (${reviews.length - publishedCount})`}
              </button>
            ))}
          </div>

          {/* Copy public link */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Copy public testimonials URL"
            >
              {copied ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
              <span>{copied ? 'Copied Link!' : 'Public Page Link'}</span>
            </button>
            <a
              href="/testimonials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-[#B8935B] hover:bg-[#9A7540] text-white transition-colors shadow-xs"
            >
              <span>View Live</span>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Testimonials Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-2xl border border-slate-200 animate-pulse shadow-xs" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
            <div className="text-5xl font-serif text-slate-200 mb-3">&ldquo;&rdquo;</div>
            <p className="text-slate-700 font-bold text-base">No testimonials found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filter === 'published'
                ? 'No reviews have been marked live yet. Publish a review below to feature it.'
                : filter === 'unpublished'
                ? 'All testimonials have already been published live!'
                : 'Client reviews submitted through their portal will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(r => {
              const client = r.careerClient ?? r.rnClient;
              const clientType = r.careerClient ? 'Career Booster' : 'Ripple Nexus';
              const clientHref = r.careerClient ? `/career/${r.careerClient.id}` : `/career`;
              const name = client?.name ?? 'Anonymous Client';
              const gradient = avatarGradient(name);

              return (
                <div
                  key={r.id}
                  className={`relative bg-white rounded-2xl border shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md group flex flex-col justify-between ${
                    r.isPublished ? 'border-slate-200/90' : 'border-slate-200 border-dashed'
                  }`}
                >
                  {/* Published top stripe */}
                  {r.isPublished && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B8935B] via-emerald-500 to-teal-400" />
                  )}

                  <div className="p-5 space-y-3.5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs`}>
                          {name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 truncate">{name}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              r.isPublished
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {r.isPublished && <PublishedDot />}
                              {r.isPublished ? 'Live' : 'Pending'}
                            </span>
                          </div>
                          {(r.designation || r.company) && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {[r.designation, r.company].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <StarRating rating={r.rating} size="md" />
                      </div>
                    </div>

                    {/* Testimonial Quote */}
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                      &ldquo;{r.testimonial}&rdquo;
                    </p>
                  </div>

                  {/* Footer Action Bar */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        {clientType}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={clientHref}
                        className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-white hover:border-slate-300 transition-colors bg-white shadow-2xs"
                      >
                        Profile
                      </a>
                      <button
                        onClick={() => void togglePublish(r.id, r.isPublished)}
                        disabled={togglingId === r.id}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all shadow-2xs disabled:opacity-50 ${
                          r.isPublished
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {togglingId === r.id ? '…' : r.isPublished ? 'Unpublish' : 'Publish Live'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Tip */}
        {!loading && reviews.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-6">
            Published testimonials automatically appear on your client-facing website. Unpublished reviews remain strictly confidential.
          </p>
        )}
      </div>
    </AppShell>
  );
}
