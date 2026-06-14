import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { syncCareerClientToFlywheel } from '@/lib/career/sync';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const clients = await db.careerClient.findMany({
      select: { id: true }
    });

    let syncedCount = 0;
    for (const client of clients) {
      const ok = await syncCareerClientToFlywheel(client.id);
      if (ok) syncedCount++;
    }

    return NextResponse.json({ success: true, count: syncedCount });

  } catch (error) {
    console.error('[SyncCareerClients] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
