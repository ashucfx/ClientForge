import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Aggregated NPS, Average Rating, Total Reviews Count
  const stats = await db.feedback.aggregate({
    _avg: { rating: true },
    _count: { id: true }
  });

  // Calculate NPS (Promoters - Detractors)
  const promoters = await db.feedback.count({ where: { npsScore: { gte: 9 } } });
  const detractors = await db.feedback.count({ where: { npsScore: { lte: 6 } } });
  const totalResponses = stats._count.id;
  
  const nps = totalResponses > 0 
    ? Math.round(((promoters / totalResponses) - (detractors / totalResponses)) * 100) 
    : 0;

  const avgRating = totalResponses > 0 && stats._avg.rating 
    ? Number(stats._avg.rating.toFixed(1)) 
    : 0;

  // 2. Service Ratings GroupBy
  const serviceStats = await db.feedback.groupBy({
    by: ['serviceType'],
    _avg: { rating: true },
    _count: { id: true },
    having: { id: { _count: { gt: 0 } } }
  });

  let mostLovedService = 'N/A';
  let lowestRatedService = 'N/A';
  let highestScore = -1;
  let lowestScore = 6;

  for (const s of serviceStats) {
    const avg = s._avg.rating || 0;
    if (avg > highestScore) {
      highestScore = avg;
      mostLovedService = s.serviceType;
    }
    if (avg < lowestScore) {
      lowestScore = avg;
      lowestRatedService = s.serviceType;
    }
  }

  const reviewsCount = await db.review.count();
  const testimonialsCollected = await db.review.count({ where: { isPublished: true } });

  return NextResponse.json({
    avgRating,
    nps,
    reviewsCount,
    testimonialsCollected,
    mostLovedService: highestScore > -1 ? `${mostLovedService} (${highestScore.toFixed(1)}⭐)` : 'N/A',
    lowestRatedService: lowestScore < 6 ? `${lowestRatedService} (${lowestScore.toFixed(1)}⭐)` : 'N/A'
  });
}
