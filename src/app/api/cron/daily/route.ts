// src/app/api/cron/daily/route.ts
// Consolidated Vercel Hobby Plan Cron handler — runs all sub-crons in parallel
// process-campaigns has its own schedule in vercel.json (10:30 AM) — NOT duplicated here

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { GET as runEmailCron } from '../email/route';
import { GET as runRemindersCron } from '../reminders/route';
import { GET as runLifecycleCron } from '../lifecycle/route';
import { GET as runCleanupCron } from '../cleanup/route';
import { GET as runInvoicesCron } from '../invoices/route';
import { GET as runSlaCron } from '../sla/route';
import { GET as runAbandonedCheckoutCron } from '../abandoned-checkout/route';
import { GET as runUpsellCron } from '../upsell/route';
import { GET as runScoreDecay } from '../../admin/flywheel/cron/score-decay/route';

async function run(name: string, fn: () => Promise<Response>): Promise<[string, string | number]> {
  try {
    const res = await fn();
    return [name, res.status];
  } catch (e: any) {
    return [name, e.message || 'error'];
  }
}

export async function GET(req: NextRequest) {
  const r = req as unknown as Request;

  // Run all sub-crons in parallel — each is independently authorized via CRON_SECRET
  const settled = await Promise.allSettled([
    run('email',             () => runEmailCron(r)),
    run('reminders',         () => runRemindersCron(r)),
    run('lifecycle',         () => runLifecycleCron(r)),
    run('cleanup',           () => runCleanupCron(r)),
    run('invoices',          () => runInvoicesCron(req)),
    run('sla',               () => runSlaCron(r)),
    run('abandoned_checkout',() => runAbandonedCheckoutCron(r)),
    run('upsell',            () => runUpsellCron(r)),
    run('score_decay',       () => runScoreDecay(req)),
  ]);

  const results: Record<string, string | number> = {};
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      const [name, status] = s.value;
      results[name] = status;
    } else {
      results['unknown'] = String(s.reason);
    }
  }

  return NextResponse.json({ ok: true, results });
}
