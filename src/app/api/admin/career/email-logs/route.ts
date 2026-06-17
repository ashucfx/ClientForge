import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status   = searchParams.get('status') ?? undefined; // 'sent' | 'queued' | 'failed'
  const clientId = searchParams.get('clientId') ?? undefined;
  const trigger  = searchParams.get('trigger') ?? undefined;
  const page     = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit    = 50;

  const where = {
    ...(status   ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(trigger  ? { trigger } : {}),
  };

  const [logs, total] = await Promise.all([
    db.careerEmailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    }),
    db.careerEmailLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/** DELETE — reset a suppressed log entry so the email can be re-sent */
export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.careerEmailLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
