import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';

// One-shot backfill: for guard entries (KEEP_WARM, STALE_REMINDER, DRAFT_REMINDER, REVIEW_REQUEST)
// that have no resendId, find the MESSAGE_NOTIFY entry for the same client and copy its resendId.
export async function POST() {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Triggers that are guard-only (no direct Resend ID stored in old data)
  const GUARD_TRIGGERS = ['KEEP_WARM', 'STALE_REMINDER', 'DRAFT_REMINDER', 'REVIEW_REQUEST',
    'GHOST_WARNING', 'GHOST_CLOSURE', 'REVISION_EXPIRY_NUDGE'];

  // All guard entries missing a resendId
  const missingIds = await db.careerEmailLog.findMany({
    where: { trigger: { in: GUARD_TRIGGERS }, resendId: null },
    select: { id: true, clientId: true, sentAt: true },
  });

  if (!missingIds.length) {
    return NextResponse.json({ synced: 0, message: 'Nothing to sync' });
  }

  // Fetch MESSAGE_NOTIFY entries that have a resendId, grouped by clientId
  const clientIds = [...new Set(missingIds.map(e => e.clientId))];
  const notifyLogs = await db.careerEmailLog.findMany({
    where: {
      clientId: { in: clientIds },
      trigger: 'MESSAGE_NOTIFY',
      resendId: { not: null },
    },
    select: { clientId: true, resendId: true, sentAt: true },
    orderBy: { sentAt: 'desc' },
  });

  // Index by clientId — keep the most-recent MESSAGE_NOTIFY per client
  const notifyByClient = new Map<string, { resendId: string; sentAt: Date }>();
  for (const log of notifyLogs) {
    if (!notifyByClient.has(log.clientId)) {
      notifyByClient.set(log.clientId, { resendId: log.resendId!, sentAt: log.sentAt });
    }
  }

  let synced = 0;
  for (const entry of missingIds) {
    const match = notifyByClient.get(entry.clientId);
    if (!match) continue;

    // Only copy if the MESSAGE_NOTIFY was sent within 5 minutes of the guard entry
    const diffMs = Math.abs(match.sentAt.getTime() - entry.sentAt.getTime());
    if (diffMs > 5 * 60 * 1000) continue;

    await db.careerEmailLog.update({
      where: { id: entry.id },
      data: { resendId: match.resendId },
    }).catch(() => null);
    synced++;
  }

  return NextResponse.json({ synced, total: missingIds.length });
}
