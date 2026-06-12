import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedBrandId = url.searchParams.get('brandId');
    
    // Brand access check
    if (requestedBrandId && !session.brandAccess.includes(requestedBrandId) && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden brand access' }, { status: 403 });
    }

    // Default to the first allowed brand if none specified
    const brandId = requestedBrandId || (session.role === 'SUPER_ADMIN' ? undefined : session.brandAccess[0]);
    const whereClause = brandId ? { brandId } : {};

    const clientMetrics = await db.flywheelClientMetrics.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc'
      },
      take: 12 // last 12 months by default
    });

    return NextResponse.json({ success: true, data: clientMetrics });
  } catch (error) {
    console.error('[FlywheelClients] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch client metrics' }, { status: 500 });
  }
}
