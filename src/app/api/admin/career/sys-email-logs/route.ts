import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status  = searchParams.get('status') ?? undefined;
  const trigger = searchParams.get('trigger') ?? undefined;
  const page    = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit   = 50;

  const where = {
    ...(status  ? { status }  : {}),
    ...(trigger ? { trigger } : {}),
  };

  const [logs, total] = await Promise.all([
    db.sysEmailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.sysEmailLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.sysEmailLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
