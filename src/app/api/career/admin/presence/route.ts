export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.activeTenant !== 'catalyst' || !session.brandAccess.includes('catalyst')) {
    return NextResponse.json({ recorded: false });
  }

  const lastActiveAt = new Date();
  try {
    await db.adminUser.update({
      where: { id: session.adminId },
      data: { lastActiveAt },
      select: { id: true },
    });
    return NextResponse.json({ recorded: true, lastActiveAt: lastActiveAt.toISOString() });
  } catch (error) {
    console.error('[admin-presence] Could not update activity:', error);
    return NextResponse.json({ error: 'Presence is temporarily unavailable.' }, { status: 503 });
  }
}
