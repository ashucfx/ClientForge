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

  return NextResponse.json({ ok: true, results });
}
