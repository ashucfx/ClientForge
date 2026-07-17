import { NextResponse } from 'next/server';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string, msgId: string } }) {
  const session = await requireRnAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    
    // Build update object
    const dataToUpdate: any = {};
    if (typeof body.isPinned === 'boolean') dataToUpdate.isPinned = body.isPinned;
    if (typeof body.isPriority === 'boolean') dataToUpdate.isPriority = body.isPriority;
    if (typeof body.isDeleted === 'boolean') dataToUpdate.isDeleted = body.isDeleted;
    if (typeof body.content === 'string') {
      dataToUpdate.content = body.content.trim();
      dataToUpdate.editedAt = new Date();
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updatedMessage = await db.rnMessage.update({
      where: { id: params.msgId, clientId: params.id },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, message: updatedMessage });
  } catch (err) {
    console.error('[RN messages PATCH]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
