// One-time SLA recalculation endpoint.
// Fixes active clients whose slaDeadline is in the past due to old calendar-day logic.
// Safe to run multiple times — only touches clients that are not yet COMPLETED.

import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { addWorkingDays, slaForSlugs } from '@/lib/workingDays';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const fixed: { id: string; name: string; oldDeadline: string; newDeadline: string; basis: string }[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  // ── Career Clients ────────────────────────────────────────────────
  // Catch both: slaDeadline in the past, OR slaDeadline is null (old clients where only expectedDeliveryAt was set)
  const breachedCareer = await db.careerClient.findMany({
    where: {
      status: { notIn: ['COMPLETED'] },
      OR: [
        { slaDeadline: { lte: now } },
        { slaDeadline: null },
      ],
    },
    select: {
      id: true,
      name: true,
      slaDeadline: true,
      createdAt: true,
      services: { select: { service: { select: { slug: true } } } },
      forms: {
        orderBy: { submittedAt: 'asc' },
        take: 1,
        select: { submittedAt: true },
      },
    },
  });

  for (const client of breachedCareer) {
    const slugs = client.services.map(s => s.service.slug);
    const slaDays = slaForSlugs(slugs);

    // Use earliest form submission as clock start; fall back to client creation date
    const startDate = client.forms[0]?.submittedAt ?? client.createdAt;
    const newDeadline = addWorkingDays(startDate, slaDays);

    // Only update if new deadline is actually in the future (genuine recalculation)
    // If still in the past, it's a real breach — leave it so admin can see it
    if (newDeadline <= now) {
      skipped.push({
        id: client.id,
        name: client.name,
        reason: `Still breached after recalculation (${slaDays} working days from ${startDate.toLocaleDateString('en-IN')})`,
      });
      continue;
    }

    await db.careerClient.update({
      where: { id: client.id },
      data: { slaDeadline: newDeadline, expectedDeliveryAt: newDeadline },
    });

    fixed.push({
      id: client.id,
      name: client.name,
      oldDeadline: client.slaDeadline ? client.slaDeadline.toLocaleDateString('en-IN') : 'not set',
      newDeadline: newDeadline.toLocaleDateString('en-IN'),
      basis: `${slaDays} working days from form submission on ${startDate.toLocaleDateString('en-IN')}`,
    });
  }

  // ── RN Clients ────────────────────────────────────────────────────
  const breachedRn = await db.rnClient.findMany({
    where: {
      currentStage: { notIn: ['LAUNCHED', 'COMPLETED'] },
      OR: [
        { slaDeadline: { lte: now } },
        { slaDeadline: null },
      ],
    },
    select: {
      id: true,
      name: true,
      slaDeadline: true,
      createdAt: true,
      stageEnteredAt: true,
    },
  });

  for (const client of breachedRn) {
    // RN clients don't have form submissions — use stageEnteredAt or createdAt
    const startDate = client.stageEnteredAt ?? client.createdAt;
    const newDeadline = addWorkingDays(startDate, 7); // default 7 working days for RN

    if (newDeadline <= now) {
      skipped.push({
        id: client.id,
        name: client.name,
        reason: `RN client still breached after recalculation (7 working days from ${startDate.toLocaleDateString('en-IN')})`,
      });
      continue;
    }

    await db.rnClient.update({
      where: { id: client.id },
      data: { slaDeadline: newDeadline },
    });

    fixed.push({
      id: client.id,
      name: client.name,
      oldDeadline: client.slaDeadline ? client.slaDeadline.toLocaleDateString('en-IN') : 'not set',
      newDeadline: newDeadline.toLocaleDateString('en-IN'),
      basis: `7 working days from stage entry on ${startDate.toLocaleDateString('en-IN')}`,
    });
  }

  return NextResponse.json({
    summary: { fixed: fixed.length, skipped: skipped.length },
    fixed,
    skipped,
  });
}
