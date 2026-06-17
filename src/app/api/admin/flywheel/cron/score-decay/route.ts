import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Decrement engagementScore by 1 for leads that haven't been contacted in 30+ days.
// Safe floor: score never goes below 0.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db.flywheelProfile.updateMany({
    where: {
      engagementScore: { gt: 0 },
      OR: [
        { lastContactedAt: { lt: thirtyDaysAgo } },
        { lastContactedAt: null },
      ],
    },
    data: {
      engagementScore: { decrement: 1 },
    },
  });

  return NextResponse.json({ ok: true, decayed: result.count });
}
