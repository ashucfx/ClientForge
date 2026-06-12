import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const queue = await db.contactMergeReview.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        sourceContact: true,
        targetContact: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, data: queue });
  } catch (error) {
    console.error('[MergeQueue] GET Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch merge queue' }, { status: 500 });
  }
}
