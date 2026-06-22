import { prisma as db } from '@/lib/db';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { TestimonialsClient } from './TestimonialsClient';
import { countryFlag } from '@/lib/countryFlag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Client Stories — Catalyst Career Boost',
  description: 'Real results from real professionals across the globe. See how Catalyst transforms careers.',
};

export default async function TestimonialsPage() {
  const raw = await db.review.findMany({
    where: { isPublished: true, careerClientId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      rating: true,
      testimonial: true,
      designation: true,
      company: true,
      linkedinUrl: true,
      createdAt: true,
      careerClient: {
        select: {
          name: true,
          contact: {
            select: { country: true, jobTitle: true, industry: true, city: true },
          },
        },
      },
    },
  });

  const reviews = raw.map(r => {
    const name = r.careerClient?.name ?? 'Anonymous';
    const contact = r.careerClient?.contact ?? null;
    const country = contact?.country ?? null;
    const role = r.designation ?? contact?.jobTitle ?? null;
    const industry = contact?.industry ?? null;
    const city = contact?.city ?? null;
    const flag = countryFlag(country);

    return {
      id: r.id,
      rating: r.rating,
      testimonial: r.testimonial,
      company: r.company ?? null,
      linkedinUrl: r.linkedinUrl,
      createdAt: r.createdAt.toISOString(),
      name,
      role,
      industry,
      country,
      city,
      flag,
      isCareer: true,
    };
  });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  const fiveStarPct = reviews.length
    ? Math.round((reviews.filter(r => r.rating === 5).length / reviews.length) * 100)
    : 0;

  // Unique countries for the filter
  const countries = Array.from(
    new Set(reviews.map(r => r.country).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="min-h-screen bg-[#F8F7F4] font-sans">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo variant="horizontal" size={30} brandId="catalyst" dark={false} />
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#B8935B] transition-colors shadow-sm"
          >
            Start your journey
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }} className="text-white">
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Label pill */}
          <div className="inline-flex items-center gap-2 border border-[#B8935B]/30 bg-[#B8935B]/10 rounded-full px-4 py-1.5 mb-8">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="#B8935B">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
            </svg>
            <span className="text-[#B8935B] text-xs font-semibold tracking-widest uppercase">Verified Client Stories</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-tight leading-[1.08] mb-6">
            Careers transformed.<br />
            <span className="bg-gradient-to-r from-[#B8935B] via-[#E2C08A] to-[#B8935B] bg-clip-text text-transparent">
              In their own words.
            </span>
          </h1>

          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Every review is unedited and written by a real client — professionals from across
            the globe who trusted us with their career growth.
          </p>

          {/* Stats */}
          {reviews.length > 0 && (
            <div className="inline-grid grid-cols-3 divide-x divide-white/10 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="px-8 py-5 text-center">
                <p className="text-4xl font-bold text-white tabular-nums">{avgRating}</p>
                <div className="flex justify-center gap-0.5 mt-1.5 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width={13} height={13} viewBox="0 0 24 24" fill="#F59E0B">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                  ))}
                </div>
                <p className="text-xs text-slate-400 tracking-wide">Avg rating</p>
              </div>
              <div className="px-8 py-5 text-center">
                <p className="text-4xl font-bold text-white tabular-nums">{reviews.length}</p>
                <p className="text-xs text-slate-400 tracking-wide mt-3">Verified reviews</p>
              </div>
              <div className="px-8 py-5 text-center">
                <p className="text-4xl font-bold text-[#B8935B] tabular-nums">{fiveStarPct}%</p>
                <p className="text-xs text-slate-400 tracking-wide mt-3">5-star experiences</p>
              </div>
            </div>
          )}

          {/* Country flags strip */}
          {countries.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {countries.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3 py-1 text-xs text-slate-300">
                  <span className="text-base leading-none">{countryFlag(c)}</span>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────────── */}
      <TestimonialsClient reviews={reviews} />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={24} brandId="catalyst" dark={false} />
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/checkout" className="hover:text-slate-700 transition-colors">Get started</Link>
            <Link href="/inquire" className="hover:text-slate-700 transition-colors">Talk to us</Link>
            <span>© {new Date().getFullYear()} Catalyst Career Boost</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
