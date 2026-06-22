import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const reviews = await db.review.findMany({
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

  const data = reviews.map(r => ({
    id: r.id,
    rating: r.rating,
    testimonial: r.testimonial,
    designation: r.designation,
    company: r.company,
    linkedinUrl: r.linkedinUrl,
    createdAt: r.createdAt,
    name: r.careerClient?.name ?? r.rnClient?.name ?? 'Anonymous',
  }));

  return NextResponse.json({ reviews: data });
}
