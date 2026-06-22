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

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={14} height={14} viewBox="0 0 24 24" fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#CBD5E1'} strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    setDeletingId(id);
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    setReviews(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
  };

  const filtered = reviews.filter(r => {
    if (filter === 'published') return r.isPublished;
    if (filter === 'unpublished') return !r.isPublished;
    return true;
  });

  const publishedCount = reviews.filter(r => r.isPublished).length;
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Testimonials & Reviews</h1>
        <p className="text-sm text-slate-500 mt-1">Manage client reviews collected through the portal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Reviews" value={reviews.length} />
        <StatCard label="Published" value={publishedCount} highlight />
        <StatCard label="Avg Rating" value={avgRating} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'published', 'unpublished'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className="mx-auto mb-3 opacity-40">
            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="font-medium">No reviews found</p>
          <p className="text-sm mt-1">Reviews submitted through client portals will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const client = r.careerClient ?? r.rnClient;
            const clientType = r.careerClient ? 'Career Booster' : 'Ripple Nexus';
            const clientHref = r.careerClient ? `/career/${r.careerClient.id}` : `/rn/clients`;

            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#B8935B] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {client?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {client?.name ?? 'Unknown client'}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-500">
                          {clientType}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          r.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      {(r.designation || r.company) && (
                        <p className="text-xs text-slate-400 mb-1">
                          {[r.designation, r.company].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      <StarRating rating={r.rating} />

                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">{r.testimonial}</p>

                      {r.linkedinUrl && (
                        <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-blue-500 hover:underline">
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                            <circle cx="4" cy="4" r="2" />
                          </svg>
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-[10px] text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <div className="flex gap-2">
                      <a href={clientHref}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                        View client
                      </a>
                      <button
                        onClick={() => void togglePublish(r.id, r.isPublished)}
                        disabled={togglingId === r.id}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          r.isPublished
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        } disabled:opacity-50`}>
                        {togglingId === r.id ? '…' : r.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => void deleteReview(r.id)}
                        disabled={deletingId === r.id}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                        {deletingId === r.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
