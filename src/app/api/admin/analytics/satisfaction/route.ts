import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Helper for satisfaction period
  const getSatisfactionMetrics = async (startDate: Date, endDate: Date) => {
    const stats = await db.feedback.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { createdAt: { gte: startDate, lt: endDate } }
    });

    const promoters = await db.feedback.count({ where: { npsScore: { gte: 9 }, createdAt: { gte: startDate, lt: endDate } } });
    const detractors = await db.feedback.count({ where: { npsScore: { lte: 6 }, createdAt: { gte: startDate, lt: endDate } } });
    const totalResponses = stats._count.id;
    
    const nps = totalResponses > 0 
      ? Math.round(((promoters / totalResponses) - (detractors / totalResponses)) * 100) 
      : null;

    const avgRating = totalResponses > 0 && stats._avg.rating 
      ? Number(stats._avg.rating.toFixed(1)) 
      : null;
      
    return { nps, avgRating, totalResponses };
  };

  const currentPeriod = await getSatisfactionMetrics(thirtyDaysAgo, now);
  const prevPeriod = await getSatisfactionMetrics(sixtyDaysAgo, thirtyDaysAgo);
  const lifetime = await getSatisfactionMetrics(new Date(0), now);

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

  const singleServiceRated = serviceStats.length === 1;

  const reviewsCount = await db.review.count();
  const prevReviewsCount = await db.review.count({ where: { createdAt: { lt: thirtyDaysAgo } } });
  const reviewsTrend = calculateTrend(reviewsCount, prevReviewsCount);
  
  const testimonialsCollected = await db.review.count({ where: { isPublished: true } });

  return NextResponse.json({
    current: currentPeriod,
    trends: {
      npsTrend: currentPeriod.nps !== null && prevPeriod.nps !== null ? currentPeriod.nps - prevPeriod.nps : 0,
      avgRatingTrend: currentPeriod.avgRating !== null && prevPeriod.avgRating !== null ? Number((currentPeriod.avgRating - prevPeriod.avgRating).toFixed(1)) : 0,
      reviewsTrend,
    },
    lifetime: {
      ...lifetime,
      reviewsCount,
      testimonialsCollected,
    },
    services: {
      singleServiceRated,
      mostLovedService: highestScore > -1 ? `${mostLovedService} (${highestScore.toFixed(1)}⭐)` : 'N/A',
      lowestRatedService: lowestScore < 6 && !singleServiceRated ? `${lowestRatedService} (${lowestScore.toFixed(1)}⭐)` : 'N/A',
      mostRatedService: singleServiceRated ? `${mostLovedService} (${highestScore.toFixed(1)}⭐)` : 'N/A'
    }
  });
}
