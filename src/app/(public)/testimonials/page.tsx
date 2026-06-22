import { prisma as db } from '@/lib/db';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Client Testimonials — Catalyst Career Boost',
  description: 'Real results. Real people. See what our clients say about their career transformation with Catalyst.',
};

const AVATAR_PALETTES = [
  { bg: 'from-[#B8935B] to-[#8B6B3D]', ring: 'ring-[#B8935B]/30' },
  { bg: 'from-[#6366F1] to-[#4338CA]', ring: 'ring-indigo-300/40' },
  { bg: 'from-[#10B981] to-[#059669]', ring: 'ring-emerald-300/40' },
  { bg: 'from-[#F59E0B] to-[#D97706]', ring: 'ring-amber-300/40' },
  { bg: 'from-[#EC4899] to-[#DB2777]', ring: 'ring-pink-300/40' },
  { bg: 'from-[#8B5CF6] to-[#7C3AED]', ring: 'ring-violet-300/40' },
];

function palette(name: string) {
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTES[code % AVATAR_PALETTES.length];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={16} height={16} viewBox="0 0 24 24"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
          strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </span>
  );
}

export default async function TestimonialsPage() {
  const raw = await db.review.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      rating: true,
      testimonial: true,
      designation: true,
      company: true,
      linkedinUrl: true,
      createdAt: true,
      careerClient: { select: { name: true } },
      rnClient: { select: { name: true } },
    },
  });

  const reviews = raw.map(r => ({
    ...r,
    name: r.careerClient?.name ?? r.rnClient?.name ?? 'Anonymous',
  }));

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const fiveStarPct = reviews.length
    ? Math.round((reviews.filter(r => r.rating === 5).length / reviews.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo variant="horizontal" size={30} brandId="catalyst" dark={false} />
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 bg-[#B8935B] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#9A7540] transition-colors shadow-sm"
          >
            Start your journey
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white pt-20 pb-28">
        {/* Subtle grid overlay */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        {/* Glow */}
        <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#B8935B]/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider uppercase text-[#B8935B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B8935B] inline-block" />
            Verified Client Stories
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Real people.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8935B] via-[#D4AF7A] to-[#B8935B]">
              Real transformations.
            </span>
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Every career journey is unique. Here&apos;s what our clients say after working with us
            — in their own words, unedited.
          </p>

          {/* Trust bar */}
          {reviews.length > 0 && (
            <div className="inline-flex flex-wrap items-center justify-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-8 py-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{avgRating}</p>
                <div className="flex justify-center mt-1">
                  <Stars rating={5} />
                </div>
                <p className="text-xs text-slate-400 mt-1">Average rating</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{reviews.length}</p>
                <p className="text-xs text-slate-400 mt-2">Verified reviews</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-[#B8935B]">{fiveStarPct}%</p>
                <p className="text-xs text-slate-400 mt-2">Gave 5 stars</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Reviews grid ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">

        {reviews.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-lg font-medium">Testimonials coming soon.</p>
          </div>
        ) : (
          <>
            {/* Masonry-style columns via CSS columns */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
              {reviews.map((r, idx) => {
                const p = palette(r.name);
                return (
                  <div
                    key={r.id}
                    className="break-inside-avoid bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group"
                  >
                    {/* Top accent line — gold for 5-star, slate for rest */}
                    <div className={`h-0.5 ${r.rating === 5 ? 'bg-gradient-to-r from-[#B8935B] via-[#D4AF7A] to-[#B8935B]' : 'bg-slate-100'}`} />

                    <div className="p-6">
                      {/* Stars */}
                      <Stars rating={r.rating} />

                      {/* Large decorative quote */}
                      <div className="relative mt-4 mb-3">
                        <span className="absolute -top-2 -left-1 text-5xl font-serif text-slate-100 leading-none select-none group-hover:text-[#B8935B]/15 transition-colors">
                          &ldquo;
                        </span>
                        <p className="relative text-slate-800 text-[15px] leading-relaxed pl-4 font-medium">
                          {r.testimonial}
                        </p>
                      </div>

                      {/* LinkedIn button if available */}
                      {r.linkedinUrl && (
                        <a
                          href={r.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#0A66C2] font-semibold hover:underline mt-2 mb-4"
                        >
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                            <circle cx="4" cy="4" r="2"/>
                          </svg>
                          Verify on LinkedIn
                        </a>
                      )}

                      {/* Author */}
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.bg} ring-2 ${p.ring} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                          {r.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                          {(r.designation || r.company) && (
                            <p className="text-xs text-slate-400 truncate">
                              {[r.designation, r.company].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        {r.rating === 5 && (
                          <span className="ml-auto flex-shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Top rated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <div className="mt-20 text-center relative">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative inline-flex">
                <div className="bg-white px-8 py-10 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto text-center">
                  <div className="flex justify-center mb-4">
                    <div className="flex -space-x-2">
                      {reviews.slice(0, 4).map((r, i) => {
                        const p = palette(r.name);
                        return (
                          <div key={r.id} className={`w-9 h-9 rounded-full bg-gradient-to-br ${p.bg} border-2 border-white text-white flex items-center justify-center text-xs font-bold`}
                            style={{ zIndex: 4 - i }}>
                            {r.name[0]?.toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm mb-1">Join {reviews.length}+ clients who transformed their careers</p>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Ready to write your own story?</h2>
                  <Link
                    href="/checkout"
                    className="inline-flex items-center gap-2 bg-[#B8935B] text-white font-semibold px-8 py-3.5 rounded-full hover:bg-[#9A7540] transition-colors shadow-md hover:shadow-lg"
                  >
                    Get started today
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                  <p className="text-xs text-slate-400 mt-4">No commitment. Talk to our team first.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <Logo variant="horizontal" size={24} brandId="catalyst" dark={false} />
          <p>© {new Date().getFullYear()} Catalyst Career Boost · All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}
