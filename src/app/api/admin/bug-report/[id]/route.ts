import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { status, adminNotes } = body;

    const data: any = {};
    if (status) data.status = status;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    const updated = await db.bugReport.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, bugReport: updated });
  } catch (error: any) {
    console.error('Update bug report error:', error);
    return NextResponse.json({ error: 'Failed to update bug report' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await db.bugReport.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete bug report' }, { status: 500 });
  }
}
