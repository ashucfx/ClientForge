import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reviews = await db.review.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      careerClient: { select: { id: true, name: true, email: true } },
      rnClient: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ reviews });
}
