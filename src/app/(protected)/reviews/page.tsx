'use client';

import { useState, useEffect, useCallback } from 'react';

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
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Decorative background quote */}
        <div aria-hidden className="absolute right-10 top-1/2 -translate-y-1/2 text-[200px] leading-none font-serif text-white opacity-[0.03] select-none pointer-events-none">
          &ldquo;
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B]" />
                <span className="text-[#B8935B] text-xs font-semibold tracking-widest uppercase">Client Voice</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Testimonials</h1>
              <p className="text-slate-400 text-sm mt-1.5 max-w-md">
                Authentic feedback from clients. Publish to your website to build trust and convert prospects.
              </p>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-white">{reviews.length}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Total</p>
              </div>
              <div className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/20 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-emerald-400">{publishedCount}</p>
                <p className="text-[10px] text-emerald-300 uppercase tracking-wider mt-0.5">Live</p>
              </div>
              <div className="bg-[#B8935B]/20 backdrop-blur-sm border border-[#B8935B]/30 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-[#B8935B]">{avgRating ?? '—'}</p>
                <p className="text-[10px] text-[#B8935B]/80 uppercase tracking-wider mt-0.5">Avg ★</p>
              </div>
              <div className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-bold text-amber-400">{fiveStarCount}</p>
                <p className="text-[10px] text-amber-300 uppercase tracking-wider mt-0.5">5-Star</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Share bar */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-6 shadow-sm flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#B8935B]/10 flex items-center justify-center">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#B8935B" strokeWidth="2" strokeLinecap="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
            </span>
            <span className="text-xs text-slate-400 font-medium flex-shrink-0">Public page:</span>
            <a
              href="/testimonials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 font-mono truncate hover:text-[#B8935B] transition-colors"
            >
              {publicUrl}
            </a>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/testimonials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Preview
            </a>
            <button
              onClick={copyLink}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#B8935B] text-white hover:bg-[#9A7540]'
              }`}
            >
              {copied ? (
                <>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {([
              { key: 'all',         label: 'All',         count: reviews.length },
              { key: 'published',   label: 'Published',   count: publishedCount },
              { key: 'unpublished', label: 'Pending',     count: reviews.length - publishedCount },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  filter === key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{count}</span>
              </button>
            ))}
          </div>

          {publishedCount > 0 && filter !== 'unpublished' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
              <PublishedDot />
              <span className="font-medium">{publishedCount} testimonial{publishedCount > 1 ? 's' : ''} live on your site</span>
            </div>
          )}
        </div>

        {/* Grid / List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-52 bg-white rounded-2xl border border-slate-200 animate-pulse shadow-sm" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="text-6xl font-serif text-slate-200 mb-4">&ldquo;&rdquo;</div>
            <p className="text-slate-500 font-semibold">No testimonials here yet</p>
            <p className="text-sm text-slate-400 mt-1">
              {filter === 'published'
                ? 'Publish a testimonial to make it visible on your site.'
                : filter === 'unpublished'
                ? 'All testimonials have been published.'
                : 'Client testimonials submitted through the portal will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(r => {
              const client = r.careerClient ?? r.rnClient;
              const clientType = r.careerClient ? 'Career Booster' : 'Ripple Nexus';
              const clientHref = r.careerClient ? `/career/${r.careerClient.id}` : `/rn/clients`;
              const name = client?.name ?? 'Unknown';
              const gradient = avatarGradient(name);

              return (
                <div
                  key={r.id}
                  className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md group ${
                    r.isPublished ? 'border-slate-200' : 'border-slate-200 border-dashed'
                  }`}
                >
                  {/* Published stripe */}
                  {r.isPublished && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
                  )}

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                          {name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">{name}</span>
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
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[r.designation, r.company].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Decorative large quote */}
                      <span className="text-4xl font-serif text-slate-100 leading-none select-none flex-shrink-0 group-hover:text-[#B8935B]/20 transition-colors">
                        &ldquo;
                      </span>
                    </div>

                    {/* Stars */}
                    <StarRating rating={r.rating} size="md" />

                    {/* Testimonial */}
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed line-clamp-4">
                      {r.testimonial}
                    </p>

                    {/* LinkedIn */}
                    {r.linkedinUrl && (
                      <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-medium text-[#0A66C2] hover:underline">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                          <circle cx="4" cy="4" r="2"/>
                        </svg>
                        View on LinkedIn
                      </a>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        {clientType}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a href={clientHref}
                        className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-white hover:border-slate-300 transition-colors bg-white">
                        Profile
                      </a>
                      <button
                        onClick={() => void togglePublish(r.id, r.isPublished)}
                        disabled={togglingId === r.id}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50 ${
                          r.isPublished
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        }`}>
                        {togglingId === r.id ? '…' : r.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom tip */}
        {!loading && reviews.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-8">
            Publish testimonials to feature them publicly. Unpublished ones are only visible to you.
          </p>
        )}
      </div>
    </div>
  );
}
