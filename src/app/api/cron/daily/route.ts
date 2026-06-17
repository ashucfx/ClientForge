// src/app/api/cron/daily/route.ts
// Consolidated Vercel Free Plan Cron handler (only 1 allowed per day)

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
import { GET as runProcessCampaigns } from '../../admin/flywheel/cron/process-campaigns/route';
import { GET as runScoreDecay } from '../../admin/flywheel/cron/score-decay/route';

export async function GET(req: NextRequest) {
  // We pass the original request along so the individual handlers can check the CRON_SECRET auth header.
  
  const results: Record<string, string | number> = {};
  
  try {
    const res = await runEmailCron(req as unknown as Request);
    results['email'] = res.status;
  } catch (e: any) {
    results['email'] = e.message || 'error';
  }

  try {
    const res = await runRemindersCron(req as unknown as Request);
    results['reminders'] = res.status;
  } catch (e: any) {
    results['reminders'] = e.message || 'error';
  }

  try {
    const res = await runLifecycleCron(req as unknown as Request);
    results['lifecycle'] = res.status;
  } catch (e: any) {
    results['lifecycle'] = e.message || 'error';
  }

  try {
    const res = await runCleanupCron(req as unknown as Request);
    results['cleanup'] = res.status;
  } catch (e: any) {
    results['cleanup'] = e.message || 'error';
  }

  try {
    const res = await runInvoicesCron(req);
    results['invoices'] = res.status;
  } catch (e: any) {
    results['invoices'] = e.message || 'error';
  }

  try {
    const res = await runSlaCron(req as unknown as Request);
    results['sla'] = res.status;
  } catch (e: any) {
    results['sla'] = e.message || 'error';
  }

  try {
    const res = await runAbandonedCheckoutCron(req as unknown as Request);
    results['abandoned_checkout'] = res.status;
  } catch (e: any) {
    results['abandoned_checkout'] = e.message || 'error';
  }

  try {
    const res = await runUpsellCron(req as unknown as Request);
    results['upsell'] = res.status;
  } catch (e: any) {
    results['upsell'] = e.message || 'error';
  }

  try {
    const res = await runProcessCampaigns(req);
    results['process_campaigns'] = res.status;
  } catch (e: any) {
    results['process_campaigns'] = e.message || 'error';
  }

  try {
    const res = await runScoreDecay(req);
    results['score_decay'] = res.status;
  } catch (e: any) {
    results['score_decay'] = e.message || 'error';
  }

  return NextResponse.json({ ok: true, results });
}
