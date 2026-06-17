import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import type { CareerServiceSlug } from '@/lib/career/types';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 7 days ago precisely
  const targetDateStart = startOfDay(subDays(new Date(), 7));
  const targetDateEnd = endOfDay(subDays(new Date(), 7));

  const candidates = await db.careerClient.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: {
        gte: targetDateStart,
        lte: targetDateEnd,
      },
      lifecycleStatus: 'ACTIVE',
    },
    include: {
      services: { select: { service: { select: { slug: true } } } },
      emailLogs: {
        where: { trigger: 'UPSELL_PITCH' } // Ensure we don't spam them
      }
    }
  });

  let queued = 0;

  for (const client of candidates) {
    if (client.emailLogs.length > 0) continue; // Already pitched

    const slugs = client.services.map(s => s.service.slug as CareerServiceSlug);
    const hasFull = slugs.includes('FULL_PACKAGE');
    const hasPortfolio = slugs.includes('PORTFOLIO');

    if (hasFull && hasPortfolio) continue; // Nothing left to upsell

    const targetUpgrade = hasFull ? 'PREMIUM_PLUS' : 'FULL_PACKAGE';
    
    await db.emailQueue.create({
      data: {
        to: client.email,
        trigger: 'UPSELL_PITCH',
        clientId: client.id,
        data: {
          name: client.name,
          targetUpgrade,
          portalLink: `${process.env.NEXT_PUBLIC_APP_URL}/portal/login`
        },
        status: 'PENDING',
        nextRunAt: new Date()
      }
    });

    // Mark that we pitched them so they don't get duplicate hooks in case the cron re-runs
    await db.careerEmailLog.create({
      data: {
        clientId: client.id,
        trigger: 'UPSELL_PITCH',
        status: 'queued'
      }
    });
    
    queued++;
  }

  return NextResponse.json({ success: true, queued, candidates: candidates.length });
}
