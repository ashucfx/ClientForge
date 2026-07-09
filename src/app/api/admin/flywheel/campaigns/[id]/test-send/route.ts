import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { sendMarketingEmail } from '@/lib/flywheel/marketingMailer';

// POST { to, stepIndex } — send a test copy of one email to any address, so the
// admin can check it in a real inbox before launching. Uses the same renderer +
// personalization as a real send (with a sample first name).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'EDITOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body?.to ?? '').trim();
  const stepIndex = Number.isFinite(body?.stepIndex) ? Number(body.stepIndex) : 0;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
  }

  const campaign = await db.flywheelCampaign.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (session.role !== 'SUPER_ADMIN' && campaign.brandId !== session.activeTenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const step = campaign.steps[Math.max(0, Math.min(stepIndex, campaign.steps.length - 1))];
  if (!step) return NextResponse.json({ error: 'This campaign has no email to test.' }, { status: 400 });

  try {
    await sendMarketingEmail(
      to,
      `[TEST] ${step.subject}`,
      step.contentHtml,
      campaign.brandId,
      `test-${campaign.id}`,   // dummy lead id — tracking links resolve to a no-op
      'Alex',                  // sample first name for {{firstName}}
    );
    return NextResponse.json({ success: true, message: `Test email sent to ${to}.` });
  } catch (e) {
    console.error('[Campaign test-send] error:', e);
    return NextResponse.json({ error: 'Could not send the test email. Check SMTP settings.' }, { status: 500 });
  }
}
