import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') || 'PENDING';

  try {
    const requests = await db.bankTransferRequest.findMany({
      where: status !== 'ALL' ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    console.error('Failed to fetch bank transfer requests:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
