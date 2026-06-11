import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { isPublished } = body;

  if (typeof isPublished !== 'boolean') {
    return NextResponse.json({ error: 'isPublished boolean is required' }, { status: 400 });
  }

  const review = await db.review.update({
    where: { id: params.id },
    data: { isPublished }
  });

  return NextResponse.json({ success: true, review });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.review.delete({
    where: { id: params.id }
  });

  return NextResponse.json({ success: true });
}
