'use client';

import { useState } from 'react';
import Link from 'next/link';
import { countryFlag } from './page';

type Review = {
  id: string;
  rating: number;
  testimonial: string;
  company: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  name: string;
  role: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  flag: string;
  isCareer: boolean;
};

const PALETTES = [
  { bg: 'from-[#B8935B] to-[#7A5C2E]' },
  { bg: 'from-[#6366F1] to-[#4338CA]' },
  { bg: 'from-[#10B981] to-[#047857]' },
  { bg: 'from-[#F59E0B] to-[#B45309]' },
  { bg: 'from-[#EC4899] to-[#BE185D]' },
  { bg: 'from-[#8B5CF6] to-[#6D28D9]' },
  { bg: 'from-[#0EA5E9] to-[#0369A1]' },
];

function palette(name: string) {
  const n = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return PALETTES[n % PALETTES.length];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={15} height={15} viewBox="0 0 24 24"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
          strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </span>
  );
}

export function TestimonialsClient({ reviews }: { reviews: Review[] }) {
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [activeRating, setActiveRating] = useState<number | null>(null);

  const countries = Array.from(
    new Set(reviews.map(r => r.country).filter(Boolean) as string[])
  ).sort();

  const filtered = reviews.filter(r => {
    if (activeCountry && r.country !== activeCountry) return false;
    if (activeRating && r.rating !== activeRating) return false;
    return true;
  });

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">

      {/* ── Filter bar ────────────────────────────────────────────── */}
      {(countries.length > 1 || true) && (
        <div className="flex flex-wrap items-center gap-2 mb-10">
          {/* Country filters */}
          {countries.length > 1 && (
            <>
              <button
                onClick={() => setActiveCountry(null)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeCountry === null
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                🌍 All countries
              </button>
              {countries.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCountry(activeCountry === c ? null : c)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeCountry === c
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <span className="text-sm leading-none">{countryFlag(c)}</span>
                  {c}
                </button>
              ))}
            </>
          )}

          {/* Divider */}
          {countries.length > 1 && (
            <div className="w-px h-5 bg-slate-200 mx-1" />
          )}

          {/* Rating filter */}
          {[5,4,3].map(star => (
            <button
              key={star}
              onClick={() => setActiveRating(activeRating === star ? null : star)}
              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeRating === star
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              {'★'.repeat(star)} {star}-star
            </button>
          ))}

          {(activeCountry || activeRating) && (
            <button
              onClick={() => { setActiveCountry(null); setActiveRating(null); }}
              className="ml-auto text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <p className="text-lg font-medium">No reviews match the selected filter.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
          {filtered.map((r) => {
            const p = palette(r.name);
            const locationLine = [r.city, r.country].filter(Boolean).join(', ');

            return (
              <div
                key={r.id}
                className="break-inside-avoid mb-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
              >
                {/* Country flag banner */}
                {r.country && (
                  <div className="relative h-1.5 bg-gradient-to-r from-slate-100 to-slate-50">
                    <div className={`absolute inset-0 ${r.rating === 5 ? 'bg-gradient-to-r from-[#B8935B] via-[#E2C08A] to-[#B8935B]' : 'bg-slate-200'}`} />
                  </div>
                )}

                <div className="p-6">
                  {/* Top row: stars + country badge */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <Stars rating={r.rating} />
                    {r.country && (
                      <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 flex-shrink-0">
                        <span className="text-base leading-none">{r.flag || '🌐'}</span>
                        {r.country}
                      </span>
                    )}
                  </div>

                  {/* Testimonial */}
                  <div className="relative mb-5">
                    <span aria-hidden className="absolute -top-1 -left-1 text-[52px] font-serif leading-none text-slate-100 select-none group-hover:text-[#B8935B]/12 transition-colors">
                      &ldquo;
                    </span>
                    <p className="relative text-slate-800 text-[15px] leading-relaxed font-[450] pl-3">
                      {r.testimonial}
                    </p>
                  </div>

                  {/* Industry tag */}
                  {r.industry && (
                    <span className="inline-block text-[11px] font-semibold text-[#B8935B] bg-[#B8935B]/8 border border-[#B8935B]/20 rounded-full px-2.5 py-0.5 mb-4">
                      {r.industry}
                    </span>
                  )}

                  {/* LinkedIn verify */}
                  {r.linkedinUrl && (
                    <a
                      href={r.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#0A66C2] font-semibold hover:underline mb-4"
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                        <circle cx="4" cy="4" r="2"/>
                      </svg>
                      Verify on LinkedIn
                    </a>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.bg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                      {r.name[0]?.toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                      {r.role && (
                        <p className="text-xs text-slate-500 truncate">{r.role}</p>
                      )}
                      {r.company && (
                        <p className="text-xs text-slate-400 truncate">{r.company}</p>
                      )}
                      {locationLine && !r.role && !r.company && (
                        <p className="text-xs text-slate-400 truncate">{locationLine}</p>
                      )}
                    </div>

                    {r.rating === 5 && (
                      <span className="flex-shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Top rated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CTA ───────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="mt-20">
          <div className="bg-slate-950 rounded-3xl px-8 py-14 text-center text-white relative overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#B8935B]/10 rounded-full blur-3xl" />

            <div className="relative">
              {/* Avatar stack */}
              <div className="flex justify-center -space-x-2 mb-6">
                {reviews.slice(0, 5).map((r) => {
                  const p = palette(r.name);
                  return (
                    <div key={r.id} className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.bg} border-2 border-slate-900 text-white flex items-center justify-center text-sm font-bold`}>
                      {r.name[0]?.toUpperCase()}
                    </div>
                  );
                })}
              </div>

              <p className="text-slate-400 text-sm mb-2">
                Join {reviews.length}+ professionals who levelled up their careers
              </p>
              <h2 className="text-3xl font-bold mb-8">
                Ready to write your story?
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/checkout"
                  className="inline-flex items-center gap-2 bg-[#B8935B] text-white font-semibold px-8 py-3.5 rounded-full hover:bg-[#9A7540] transition-colors shadow-lg"
                >
                  Get started
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
                <Link
                  href="/inquire"
                  className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/15 transition-colors"
                >
                  Talk to us first
                </Link>
              </div>
              <p className="text-xs text-slate-500 mt-5">No commitment required · Free consultation available</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
