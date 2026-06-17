// src/app/api/admin/bug-report/list/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  void req;
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bugs = await db.bugReport.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ bugs });
}
