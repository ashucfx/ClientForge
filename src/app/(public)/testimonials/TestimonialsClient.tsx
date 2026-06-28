'use client';

import { useState } from 'react';
import Link from 'next/link';
import { countryFlag } from '@/lib/countryFlag';

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
  packageLabel: string | null;
  isCareer: boolean;
};

const AVATAR_PALETTES = [
  'from-[#B8935B] to-[#7A5C2E]',
  'from-[#6366F1] to-[#4338CA]',
  'from-[#10B981] to-[#047857]',
  'from-[#F59E0B] to-[#B45309]',
  'from-[#EC4899] to-[#BE185D]',
  'from-[#8B5CF6] to-[#6D28D9]',
  'from-[#0EA5E9] to-[#0369A1]',
];

function avatarPalette(name: string) {
  const n = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={14} height={14} viewBox="0 0 24 24"
          fill={i <= rating ? '#F59E0B' : 'none'}
          stroke={i <= rating ? '#F59E0B' : '#D1D5DB'}
          strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const PKG_COLOURS: Record<string, string> = {
  'Career Booster': 'text-emerald-700 bg-emerald-50 border-emerald-100',
  'Premium Plus':   'text-violet-700 bg-violet-50 border-violet-100',
};
function pkgColour(label: string) {
  return PKG_COLOURS[label] ?? 'text-blue-700 bg-blue-50 border-blue-100';
}

export function TestimonialsClient({ reviews }: { reviews: Review[] }) {
  const [activeCountry,  setActiveCountry]  = useState<string | null>(null);
  const [activeRating,   setActiveRating]   = useState<number | null>(null);
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);

  const countries  = Array.from(new Set(reviews.map(r => r.country).filter(Boolean)  as string[])).sort();
  const industries = Array.from(new Set(reviews.map(r => r.industry).filter(Boolean) as string[])).sort();

  const filtered = reviews.filter(r => {
    if (activeCountry  && r.country  !== activeCountry)  return false;
    if (activeRating   && r.rating   !== activeRating)   return false;
    if (activeIndustry && r.industry !== activeIndustry) return false;
    return true;
  });

  const hasFilters = activeCountry || activeRating || activeIndustry;

  function clearAll() {
    setActiveCountry(null);
    setActiveRating(null);
    setActiveIndustry(null);
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-14">

      {/* ── Filter panel ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-10 space-y-4 shadow-sm">

        {/* Country filter */}
        {countries.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 shrink-0 pt-0.5">Country</span>
            <FilterChip active={!activeCountry} onClick={() => setActiveCountry(null)}>🌍 All</FilterChip>
            {countries.map(c => (
              <FilterChip key={c} active={activeCountry === c} onClick={() => setActiveCountry(activeCountry === c ? null : c)}>
                <span className="text-sm leading-none">{countryFlag(c)}</span> {c}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Industry filter */}
        {industries.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 shrink-0 pt-0.5">Industry</span>
            <FilterChip active={!activeIndustry} accent onClick={() => setActiveIndustry(null)}>All</FilterChip>
            {industries.map(ind => (
              <FilterChip key={ind} active={activeIndustry === ind} accent onClick={() => setActiveIndustry(activeIndustry === ind ? null : ind)}>
                {ind}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Rating filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 shrink-0 pt-0.5">Rating</span>
          {[5, 4, 3].map(star => (
            <button key={star} onClick={() => setActiveRating(activeRating === star ? null : star)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeRating === star
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700'
              }`}>
              {'★'.repeat(star)} {star}-star
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearAll} className="ml-auto text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
              Clear all filters
            </button>
          )}
        </div>

      </div>

      {/* ── Result count ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of <span className="font-semibold text-slate-900">{reviews.length}</span> verified reviews
        </p>
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-[#B8935B] hover:underline font-medium">Reset</button>
        )}
      </div>

      {/* ── Masonry grid ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-medium text-slate-600">No reviews match the selected filters.</p>
          <p className="text-sm mt-1 text-slate-400">Try adjusting or clearing your filters to see more stories.</p>
          <button onClick={clearAll} className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#B8935B] font-semibold hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
          {filtered.map((r) => {
            const grad = avatarPalette(r.name);
            const location = [r.city, r.country].filter(Boolean).join(', ');
            const isVerified = !!r.linkedinUrl;

            return (
              <div key={r.id}
                className="break-inside-avoid mb-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group">

                {/* Top accent line */}
                <div className={`h-[3px] w-full ${r.rating === 5
                  ? 'bg-gradient-to-r from-[#B8935B] via-[#E2C08A] to-[#B8935B]'
                  : 'bg-gradient-to-r from-slate-100 to-slate-200'}`}
                />

                <div className="p-6">

                  {/* Row 1: stars + date */}
                  <div className="flex items-center justify-between mb-4">
                    <Stars rating={r.rating} />
                    <span className="text-[11px] text-slate-400 font-medium tabular-nums">{formatDate(r.createdAt)}</span>
                  </div>

                  {/* Quote block */}
                  <div className="relative mb-5">
                    <span aria-hidden
                      className="absolute -top-2 -left-1 text-[68px] font-serif leading-none select-none pointer-events-none text-slate-100 group-hover:text-[#B8935B]/12 transition-colors">
                      &ldquo;
                    </span>
                    <p className="relative text-slate-800 text-[15px] leading-[1.8] font-[450] pl-4">
                      {r.testimonial}
                    </p>
                  </div>

                  {/* Context chips: industry · package · location */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {r.industry && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B8935B] bg-[#B8935B]/8 border border-[#B8935B]/20 rounded-full px-2.5 py-1 leading-none">
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                        </svg>
                        {r.industry}
                      </span>
                    )}
                    {r.packageLabel && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2.5 py-1 leading-none ${pkgColour(r.packageLabel)}`}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        {r.packageLabel}
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 leading-none">
                        <span className="text-[13px] leading-none">{r.flag || '🌐'}</span>
                        {location}
                      </span>
                    )}
                  </div>

                  {/* LinkedIn link */}
                  {r.linkedinUrl && (
                    <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#0A66C2] font-semibold hover:underline mb-4 transition-opacity hover:opacity-80">
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                        <circle cx="4" cy="4" r="2"/>
                      </svg>
                      View LinkedIn profile
                    </a>
                  )}

                  {/* Author row */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                      {r.name[0]?.toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                      {r.role && (
                        <p className="text-[12px] text-slate-600 font-medium truncate leading-tight mt-0.5">{r.role}</p>
                      )}
                      {r.company && (
                        <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{r.company}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {r.rating === 5 && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ★ Top rated
                        </span>
                      )}
                      {isVerified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="mt-20">
          <div className="bg-slate-950 rounded-3xl px-8 py-14 text-center text-white relative overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#B8935B]/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="flex justify-center -space-x-2 mb-6">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarPalette(r.name)} border-2 border-slate-900 text-white flex items-center justify-center text-sm font-bold`}>
                    {r.name[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-sm mb-2">
                Join {reviews.length}+ professionals who have already levelled up their careers
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-8">Ready to write your story?</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/checkout"
                  className="inline-flex items-center gap-2 bg-[#B8935B] text-white font-semibold px-8 py-3.5 rounded-full hover:bg-[#9A7540] transition-colors shadow-lg">
                  Get started now
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
                <Link href="/inquire"
                  className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/15 transition-colors">
                  Talk to us first
                </Link>
              </div>
              <p className="text-xs text-slate-500 mt-5">No commitment required · Response within 24–48 hours</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Reusable filter chip ─────────────────────────────────────────────── */
function FilterChip({
  active, accent = false, onClick, children,
}: {
  active: boolean; accent?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const base  = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer';
  const on    = accent ? 'bg-[#B8935B] text-white border-[#B8935B]' : 'bg-slate-900 text-white border-slate-900';
  const off   = accent
    ? 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#B8935B]/50 hover:text-[#B8935B]'
    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400';
  return (
    <button className={`${base} ${active ? on : off}`} onClick={onClick}>
      {children}
    </button>
  );
}
